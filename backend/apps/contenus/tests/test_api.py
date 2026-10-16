"""API des contenus : accueil public (/api/contenus/accueil/) et équipe (/api/admin/contenus/)."""
import json

from rest_framework.test import APITestCase

from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre, image_png, video_mp4
from apps.contenus.models import Bandeau, ContenuAccueil, PhotoSphere

URL = "/api/contenus/accueil/"
URL_ADMIN = "/api/admin/contenus/"


class AccueilPublicTests(MediasTemporairesMixin, APITestCase):
    def test_valeurs_vides_et_coordonnees(self):
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data), {"titre", "accroche", "video_fond", "image_affiche", "texte_partenaire",
                                       "coordonnees", "bandeaux", "sphere"})
        self.assertEqual(r.data["titre"], "")
        self.assertIsNone(r.data["video_fond"])
        self.assertIsNone(r.data["image_affiche"])
        self.assertEqual(r.data["coordonnees"]["whatsapp"], "+237 622 191 931")
        self.assertEqual(len(r.data["coordonnees"]["telephones"]), 3)
        self.assertEqual((r.data["bandeaux"], r.data["sphere"]), ([], []))

    def test_accueil_traduit_avec_bandeaux_et_sphere(self):
        contenu = ContenuAccueil.charger()
        contenu.titre = "Des sols qui durent"
        contenu.traductions = {"en": {"titre": "Floors that last"}}
        contenu.save()
        Bandeau.objects.create(texte="Promotion", lien="/catalogue", traductions={"en": {"texte": "Special offer"}})
        Bandeau.objects.create(texte="Inactif", actif=False)
        famille = Famille.objects.create(nom="Finitions")
        produit = Produit.objects.create(famille=famille, nom="Sol autolissant")
        PhotoSphere.objects.create(image=image_png(), produit=produit)
        r = self.client.get(URL, HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.data["titre"], "Floors that last")
        self.assertEqual([(b["texte"], b["lien"]) for b in r.data["bandeaux"]], [("Special offer", "/catalogue")])
        photo = r.data["sphere"][0]
        self.assertTrue(photo["image"]["url"].startswith("http://testserver/media/contenus/sphere/"))
        self.assertEqual(photo["image"]["alt"], "Sol autolissant")
        self.assertEqual(photo["produit"], {"slug": produit.slug, "nom": "Sol autolissant"})


class ContenusEquipeTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())

    def test_acces_reserve(self):
        self.client.force_authenticate(creer_client())
        for route in ("accueil/", "bandeaux/", "sphere/"):
            self.assertEqual(self.client.get(f"{URL_ADMIN}{route}").status_code, 403)

    def test_accueil_get_patch_multipart(self):
        r = self.client.get(f"{URL_ADMIN}accueil/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["langues_incompletes"], [])
        r = self.client.patch(f"{URL_ADMIN}accueil/", {
            "titre": "Des sols qui durent", "telephones": json.dumps(["+237 6 99 81 16 35"]),
            "traductions": json.dumps({"en": {"titre": "Floors that last"}}), "video_fond": video_mp4("fond.webm"),
        }, format="multipart")
        self.assertEqual(r.status_code, 400)  # contenu .mp4 sous une extension .webm
        self.assertIn("video_fond", r.data)
        r = self.client.patch(f"{URL_ADMIN}accueil/", {
            "titre": "Des sols qui durent", "telephones": json.dumps(["+237 6 99 81 16 35"]),
            "traductions": json.dumps({"en": {"titre": "Floors that last"}}), "video_fond": video_mp4(),
            "image_affiche": image_png(),
        }, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["telephones"], ["+237 6 99 81 16 35"])
        self.assertEqual(r.data["langues_incompletes"], ["zh", "de", "ja"])
        self.assertTrue(r.data["video_fond"].startswith("http://testserver/media/contenus/"))
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"video_fond": None, "telephones": ["abc"]}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"{URL_ADMIN}accueil/", {"video_fond": None}, format="json")
        self.assertIsNone(r.data["video_fond"])

    def test_bandeaux(self):
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "lien": "https://ailleurs.com"},
                             format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("lien", r.data)
        r = self.client.post(f"{URL_ADMIN}bandeaux/", {"texte": "Promo", "lien": "/catalogue"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsInstance(self.client.get(f"{URL_ADMIN}bandeaux/").data, list)
        self.assertEqual(self.client.delete(f"{URL_ADMIN}bandeaux/{r.data['id']}/").status_code, 204)

    def test_sphere(self):
        ids = []
        for _ in range(3):
            r = self.client.post(f"{URL_ADMIN}sphere/", {"image": image_png(), "alt": "Sol"}, format="multipart")
            self.assertEqual(r.status_code, 201, r.content)
            ids.append(r.data["id"])
        self.assertEqual([p["ordre"] for p in self.client.get(f"{URL_ADMIN}sphere/").data], [0, 1, 2])
        r = self.client.post(f"{URL_ADMIN}sphere/ordre/", {"ids": list(reversed(ids))}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual([p["id"] for p in r.data], list(reversed(ids)))
        r = self.client.post(f"{URL_ADMIN}sphere/ordre/", {"ids": [99999]}, format="json")
        self.assertEqual(r.status_code, 400)
