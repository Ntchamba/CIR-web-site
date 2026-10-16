"""Tests de fumée du noyau (la suite complète est écrite par backend-testeur)."""
from io import BytesIO

from django.test import TestCase
from PIL import Image

from apps.noyau.images import convertir_en_webp


class SanteTests(TestCase):
    def test_sante_repond_ok(self):
        reponse = self.client.get("/api/sante/")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json(), {"statut": "ok", "base_de_donnees": True})


class ImagesTests(TestCase):
    def test_conversion_webp_et_reduction(self):
        source = BytesIO()
        Image.new("RGB", (3000, 1500), "#1177A8").save(source, "PNG")
        source.seek(0)
        octets = convertir_en_webp(source, largeur_max=1000)
        with Image.open(BytesIO(octets)) as resultat:
            self.assertEqual(resultat.format, "WEBP")
            self.assertEqual(resultat.size, (1000, 500))
