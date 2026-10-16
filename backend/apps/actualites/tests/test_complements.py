"""Tests complémentaires des actualités (revue de l'agent backend-testeur, vague 1)."""
from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.actualites.models import Actualite
from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre, image_png

URL = "/api/actualites/"
URL_ADMIN = "/api/admin/actualites/"


class VisibiliteTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        famille = Famille.objects.create(nom="Finitions")
        self.cache = Produit.objects.create(famille=famille, nom="Produit caché", en_ligne=False)
        hier = timezone.now() - timedelta(days=1)
        self.visible = Actualite.objects.create(titre="Visible", publie_le=hier, produit=self.cache)
        self.brouillon = Actualite.objects.create(titre="Brouillon", publie=False, publie_le=hier)
        self.programmee = Actualite.objects.create(titre="Programmée",
                                                   publie_le=timezone.now() + timedelta(minutes=5))

    def test_brouillon_et_programmee_invisibles(self):
        r = self.client.get(URL)
        self.assertEqual([a["slug"] for a in r.data["results"]], [self.visible.slug])
        for actualite in (self.brouillon, self.programmee):
            with self.subTest(actualite=actualite.titre):
                self.assertEqual(self.client.get(f"{URL}{actualite.slug}/").status_code, 404)

    def test_produit_hors_ligne_masque(self):
        r = self.client.get(f"{URL}{self.visible.slug}/")
        self.assertIsNone(r.data["produit"])
        self.assertNotIn("Produit caché", str(r.data))

    def test_programmee_visible_une_fois_la_date_passee(self):
        Actualite.objects.filter(pk=self.programmee.pk).update(publie_le=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get(f"{URL}{self.programmee.slug}/").status_code, 200)

    def test_jeton_perime_et_ecriture_publique(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer jeton-perime")
        self.assertEqual(self.client.get(URL).status_code, 200)
        self.client.credentials()
        self.client.force_authenticate(creer_client())
        self.assertEqual(self.client.post(URL, {"titre": "x"}, format="json").status_code, 405)

    def test_plus_recente_en_premier_et_plafond_de_taille(self):
        for i in range(3):
            Actualite.objects.create(titre=f"A{i}", publie_le=timezone.now() - timedelta(hours=i + 1))
        r = self.client.get(f"{URL}?taille=500")
        dates = [a["publie_le"] for a in r.data["results"]]
        self.assertEqual(dates, sorted(dates, reverse=True))
        self.assertEqual(r.data["count"], 4)


class RequetesN1Tests(MediasTemporairesMixin, APITestCase):
    def test_liste_publique_et_equipe(self):
        famille = Famille.objects.create(nom="Finitions")
        produit = Produit.objects.create(famille=famille, nom="Sol")
        hier = timezone.now() - timedelta(days=1)
        Actualite.objects.create(titre="A0", publie_le=hier, produit=produit, image=image_png())

        def compter(url):
            with CaptureQueriesContext(connection) as requetes:
                self.assertEqual(self.client.get(url).status_code, 200)
            return len(requetes)

        avant = compter(URL)
        self.client.force_authenticate(creer_membre())
        avant_equipe = compter(URL_ADMIN)
        for i in range(1, 6):
            Actualite.objects.create(titre=f"A{i}", publie_le=hier, produit=produit, image=image_png())
        self.assertEqual(compter(URL_ADMIN), avant_equipe)
        self.client.force_authenticate(None)
        self.assertEqual(compter(URL), avant)


class EquipeTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())

    def test_acces_non_connecte_refuse(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 401)
        self.assertEqual(self.client.post(URL_ADMIN, {"titre": "x"}, format="json").status_code, 401)

    def test_programmation_et_date_par_defaut(self):
        r = self.client.post(URL_ADMIN, {"titre": "Maintenant", "publie_le": None, "slug": "pirate"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertFalse(r.data["programmee"])
        self.assertEqual(r.data["slug"], "maintenant")
        self.assertTrue(r.data["publie"])
        r = self.client.patch(f"{URL_ADMIN}{r.data['id']}/",
                              {"publie_le": (timezone.now() + timedelta(days=2)).isoformat(), "programmee": False},
                              format="json")
        self.assertTrue(r.data["programmee"])

    def test_programmee_visible_dans_la_liste_de_l_equipe(self):
        Actualite.objects.create(titre="Futur", publie_le=timezone.now() + timedelta(days=3))
        Actualite.objects.create(titre="Brouillon", publie=False)
        self.assertEqual(self.client.get(URL_ADMIN).data["count"], 2)

    def test_image_retiree_et_fichier_efface(self):
        r = self.client.post(URL_ADMIN, {"titre": "Avec image", "image": image_png()}, format="multipart")
        actualite = Actualite.objects.get(pk=r.data["id"])
        stockage, nom = actualite.image.storage, actualite.image.name
        self.assertTrue(stockage.exists(nom))
        r = self.client.patch(f"{URL_ADMIN}{actualite.id}/", {"image": ""}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.data["image"])
        self.assertFalse(stockage.exists(nom))

    def test_traductions_et_titre_controles(self):
        for donnees in ({"titre": "   "}, {"traductions": {"en": {"produit": "x"}}}, {"traductions": ["en"]}):
            with self.subTest(donnees=donnees):
                r = self.client.post(URL_ADMIN, {"titre": "Ok", **donnees}, format="json")
                self.assertEqual(r.status_code, 400, r.content)
        r = self.client.post(URL_ADMIN, {"titre": "Ok", "resume": "Court",
                                         "traductions": {"en": {"titre": "Ok", "resume": "Short"}}}, format="json")
        self.assertEqual(r.data["langues_incompletes"], ["zh", "de", "ja"])

    def test_suppression_du_produit_lie(self):
        famille = Famille.objects.create(nom="Finitions")
        produit = Produit.objects.create(famille=famille, nom="Sol")
        actualite = Actualite.objects.create(titre="Lien", produit=produit)
        produit.delete()
        actualite.refresh_from_db()
        self.assertIsNone(actualite.produit)
