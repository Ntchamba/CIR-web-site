"""Tests complémentaires des contenus de l'accueil (revue de l'agent backend-testeur, vague 1)."""
from datetime import timedelta
from pathlib import Path
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre, image_png, video_mp4
from apps.contenus.models import Bandeau, ContenuAccueil, PhotoSphere
from apps.noyau.images import ImageInvalide

URL = "/api/contenus/accueil/"
URL_ADMIN = "/api/admin/contenus/"


class AccueilPublicTests(MediasTemporairesMixin, APITestCase):
    def test_bandeaux_selon_leurs_dates(self):
        maintenant = timezone.now()
        Bandeau.objects.create(texte="En cours", debut=maintenant - timedelta(days=1),
                               fin=maintenant + timedelta(days=1))
        Bandeau.objects.create(texte="A venir", debut=maintenant + timedelta(hours=1))
        Bandeau.objects.create(texte="Fini", fin=maintenant - timedelta(seconds=1))
        r = self.client.get(URL)
        self.assertEqual([b["texte"] for b in r.data["bandeaux"]], ["En cours"])
        self.assertEqual(set(r.data["bandeaux"][0]), {"id", "texte", "lien"})

    def test_sphere_produit_hors_ligne_masque(self):
        famille = Famille.objects.create(nom="Finitions")
        cache = Produit.objects.create(famille=famille, nom="Produit secret", en_ligne=False)
        PhotoSphere.objects.create(image=image_png(), produit=cache)
        r = self.client.get(URL)
        photo = r.data["sphere"][0]
        self.assertIsNone(photo["produit"])
        self.assertNotIn("Produit secret", str(r.data))
        self.assertTrue(photo["image"]["url"].startswith("http://testserver/media/"))

    def test_nombre_de_requetes_constant(self):
        famille = Famille.objects.create(nom="Finitions")
        produit = Produit.objects.create(famille=famille, nom="Sol")
        ContenuAccueil.charger()
        PhotoSphere.objects.create(image=image_png(), produit=produit)
        Bandeau.objects.create(texte="B0")

        def compter():
            with CaptureQueriesContext(connection) as requetes:
                self.assertEqual(self.client.get(URL).status_code, 200)
            return len(requetes)

        avant = compter()
        for i in range(5):
            PhotoSphere.objects.create(image=image_png(), produit=produit)
            Bandeau.objects.create(texte=f"B{i + 1}")
        self.assertEqual(compter(), avant)

    def test_jeton_perime_ignore_et_traduction_ja_avec_secours(self):
        contenu = ContenuAccueil.charger()
        contenu.titre, contenu.accroche = "Titre", "Accroche"
        contenu.traductions = {"ja": {"titre": "タイトル"}}
        contenu.save()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer jeton-perime")
        r = self.client.get(URL, HTTP_ACCEPT_LANGUAGE="ja")
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.data["titre"], r.data["accroche"]), ("タイトル", "Accroche"))
        self.assertNotIn("traductions", r.data)
        self.assertEqual(r.data["coordonnees"]["adresse"], "Total Nkolmbong, Douala")  # nom propre non traduit


class EquipeTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())

    def test_acces_non_connecte_et_client(self):
        for utilisateur, attendu in ((None, 401), (creer_client(), 403)):
            self.client.force_authenticate(utilisateur)
            for methode, route in (("patch", "accueil/"), ("post", "bandeaux/"), ("post", "sphere/"),
                                   ("post", "sphere/ordre/")):
                with self.subTest(utilisateur=utilisateur, route=route):
                    self.assertEqual(getattr(self.client, methode)(f"{URL_ADMIN}{route}", {}, format="json")
                                     .status_code, attendu)

    def test_liens_de_bandeau_hors_du_site_refuses(self):
        for lien in ("//exemple.com", "/\\exemple.com", "javascript:alert(1)", "catalogue", "/\t/exemple.com",
                     "/\n/exemple.com"):
            with self.subTest(lien=lien):
                r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "lien": lien}, format="json")
                self.assertEqual(r.status_code, 400, r.content)
        self.assertFalse(Bandeau.objects.exists())

    def test_bandeau_dates_et_traductions(self):
        maintenant = timezone.now()
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "debut": maintenant.isoformat(),
                                                       "fin": maintenant.isoformat()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("fin", r.data)
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "traductions": {"en": {"lien": "/x"}}},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_telephones_et_whatsapp(self):
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"telephones": [f"+237 6 99 81 16 3{i}" for i in range(7)]},
                              format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"whatsapp": "<script>"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"telephones": ["+237 6 99 81 16 35", " +237  6 99 81 16 35 "],
                                                       "email": "contact@revelation-sarl.com"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["telephones"], ["+237 6 99 81 16 35"])
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"email": "pas-un-email"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_image_affiche_invalide_400_sur_le_champ(self):
        with mock.patch("apps.noyau.medias.optimiser_champ_image", side_effect=ImageInvalide("Trop lourde")):
            r = self.client.patch(f"{URL_ADMIN}accueil/", {"image_affiche": image_png()}, format="multipart")
        self.assertEqual((r.status_code, r.data), (400, {"image_affiche": ["Trop lourde"]}))

    def test_video_de_fond_plafonnee_a_30_mo(self):
        with mock.patch("apps.contenus.services.VIDEO_FOND_OCTETS_MAX", 100):
            r = self.client.patch(f"{URL_ADMIN}accueil/", {"video_fond": video_mp4(taille=200)}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("video_fond", r.data)
        from apps.contenus import services
        self.assertEqual(services.VIDEO_FOND_OCTETS_MAX, 30 * 1024 * 1024)

    def test_video_conservee_si_l_image_est_refusee(self):
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"video_fond": video_mp4()}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        chemin = Path(ContenuAccueil.charger().video_fond.path)
        with mock.patch("apps.noyau.medias.optimiser_champ_image", side_effect=ImageInvalide("Trop lourde")):
            r = self.client.patch(f"{URL_ADMIN}accueil/", {"video_fond": "", "image_affiche": image_png()},
                                  format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(ContenuAccueil.charger().video_fond)
        self.assertTrue(chemin.exists(), "la vidéo a été effacée alors que la modification est refusée")

    def test_sphere_ordre_et_suppression(self):
        photos = [PhotoSphere.objects.create(image=image_png(), ordre=i) for i in range(3)]
        for ids in ([photos[0].id, photos[0].id], ["a"], [True]):
            with self.subTest(ids=ids):
                r = self.client.post(f"{URL_ADMIN}sphere/ordre/", {"ids": ids}, format="json")
                self.assertEqual(r.status_code, 400)
        r = self.client.post(f"{URL_ADMIN}sphere/ordre/", {"ids": [photos[2].id]}, format="json")
        self.assertEqual([p["id"] for p in r.data], [photos[2].id, photos[0].id, photos[1].id])
        stockage, nom = photos[0].image.storage, photos[0].image.name
        self.assertEqual(self.client.delete(f"{URL_ADMIN}sphere/{photos[0].id}/").status_code, 204)
        self.assertFalse(stockage.exists(nom))
