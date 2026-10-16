"""API des actualités : publique (/api/actualites/) et équipe (/api/admin/actualites/)."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.actualites.models import Actualite
from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre, image_png

URL = "/api/actualites/"
URL_ADMIN = "/api/admin/actualites/"


class ActualitesApiTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        famille = Famille.objects.create(nom="Finitions")
        self.produit = Produit.objects.create(famille=famille, nom="Sol autolissant",
                                              traductions={"ja": {"nom": "セルフレベリング床"}})
        maintenant = timezone.now()
        for jours in range(1, 5):
            Actualite.objects.create(titre=f"Actualité {jours}", publie_le=maintenant - timedelta(days=jours),
                                     produit=self.produit, traductions={"ja": {"titre": f"ニュース {jours}"}})
        self.futur = Actualite.objects.create(titre="Bientôt", publie_le=maintenant + timedelta(days=1))

    def test_liste_publique(self):
        r = self.client.get(f"{URL}?taille=3", HTTP_ACCEPT_LANGUAGE="ja")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 4)
        self.assertEqual([a["titre"] for a in r.data["results"]], ["ニュース 1", "ニュース 2", "ニュース 3"])
        self.assertEqual(r.data["results"][0]["produit"], {"slug": self.produit.slug, "nom": "セルフレベリング床"})
        self.assertIsNone(r.data["results"][0]["image"])
        self.assertEqual(set(r.data["results"][0]),
                         {"id", "slug", "titre", "resume", "texte", "image", "produit", "publie_le"})
        self.assertEqual(self.client.get(f"{URL}{self.futur.slug}/").status_code, 404)
        self.assertEqual(self.client.get(f"{URL}actualite-1/").status_code, 200)

    def test_equipe(self):
        self.client.force_authenticate(creer_client())
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 403)
        self.client.force_authenticate(creer_membre())
        r = self.client.get(URL_ADMIN)
        self.assertEqual(r.data["count"], 5)
        demain = (timezone.now() + timedelta(days=1)).isoformat()
        r = self.client.post(URL_ADMIN, {"titre": "Programmée", "publie_le": demain, "image": image_png(),
                                         "produit": self.produit.id}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data["programmee"])
        self.assertTrue(r.data["image"].startswith("http://testserver/media/actualites/"))
        self.assertEqual(r.data["langues_incompletes"], ["en", "zh", "de", "ja"])
        r = self.client.patch(f"{URL_ADMIN}{r.data['id']}/", {"image": None, "resume": "x" * 281}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("resume", r.data)
