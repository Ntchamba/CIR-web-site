"""Tests complémentaires des contenus de l'accueil (revue de l'agent backend-testeur, vague 1)."""
from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone
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
        """Dates entières, début et fin inclus (jour de Douala)."""
        jour = timezone.localdate()
        un = timedelta(days=1)
        Bandeau.objects.create(texte="En cours", debut=jour - un, fin=jour + un)
        Bandeau.objects.create(texte="Finit aujourd'hui", fin=jour)
        Bandeau.objects.create(texte="Commence aujourd'hui", debut=jour)
        Bandeau.objects.create(texte="Un seul jour", debut=jour, fin=jour)
        Bandeau.objects.create(texte="A venir", debut=jour + un)
        Bandeau.objects.create(texte="Fini hier", fin=jour - un)
        Bandeau.objects.create(texte="Inactif", actif=False, debut=jour - un, fin=jour + un)
        r = self.client.get(URL)
        self.assertEqual(sorted(b["texte"] for b in r.data["bandeaux"]),
                         sorted(["En cours", "Finit aujourd'hui", "Commence aujourd'hui", "Un seul jour"]))
        self.assertEqual(set(r.data["bandeaux"][0]), {"id", "texte", "lien"})

    def test_bandeaux_suivent_le_jour_de_douala(self):
        """À 23 h 30 UTC, il est déjà 0 h 30 le lendemain à Douala (UTC+1)."""
        instant = datetime(2026, 10, 16, 23, 30, tzinfo=dt_timezone.utc)
        Bandeau.objects.create(texte="Fini le 16", fin=date(2026, 10, 16))
        Bandeau.objects.create(texte="Commence le 17", debut=date(2026, 10, 17))
        with mock.patch("django.utils.timezone.now", return_value=instant):
            r = self.client.get(URL)
        self.assertEqual([b["texte"] for b in r.data["bandeaux"]], ["Commence le 17"])

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
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "debut": "2026-10-20", "fin": "2026-10-19"},
                             format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("fin", r.data)
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "debut": "2026-10-20", "fin": "2026-10-20"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["debut"], r.data["fin"]), ("2026-10-20", "2026-10-20"))
        bandeau_id = r.data["id"]
        r = self.client.patch(f"{URL_ADMIN}bandeaux/{bandeau_id}/", {"debut": "2026-10-21"}, format="json")
        self.assertEqual(r.status_code, 400)  # la fin existante précéderait le nouveau début
        self.assertEqual(str(Bandeau.objects.get(pk=bandeau_id).debut), "2026-10-20")
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "debut": "20/10/2026"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("debut", r.data)
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "fin": "2026-10-19", "debut": None},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "traductions": {"en": {"lien": "/x"}}},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_message_de_dates_traduit(self):
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "debut": "2026-10-20", "fin": "2026-10-19"},
                             format="json", HTTP_ACCEPT_LANGUAGE="de")
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("précéder", str(r.data["fin"][0]))

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


class LiensEtPhotosTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())

    def test_liens_internes_acceptes(self):
        for lien in ("/", "/catalogue", "/catalogue?usage=maison#haut", "/catalogue/sol-autolissant-yd-500", ""):
            with self.subTest(lien=lien):
                r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "lien": lien}, format="json")
                self.assertEqual(r.status_code, 201, r.content)
        for lien in ("/catalogue produits", "/\x00x", "/\x7fx"):
            with self.subTest(lien=lien):
                r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "lien": lien}, format="json")
                self.assertEqual(r.status_code, 400, r.content)

    def test_remplacement_de_photo_de_la_sphere(self):
        r = self.client.post(f"{URL_ADMIN}sphere/", {"image": image_png()}, format="multipart")
        photo = PhotoSphere.objects.get(pk=r.data["id"])
        ancienne = Path(photo.image.path)
        with mock.patch("apps.noyau.medias.optimiser_champ_image", side_effect=ImageInvalide("Trop lourde")):
            r = self.client.patch(f"{URL_ADMIN}sphere/{photo.id}/", {"image": image_png("b.png")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(ancienne.exists())
        r = self.client.patch(f"{URL_ADMIN}sphere/{photo.id}/", {"image": image_png("c.png")}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(ancienne.exists())
