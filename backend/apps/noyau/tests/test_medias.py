"""Médias : service de /media/ avec en-tête de cache, contrôle des vidéos, slugs."""
import shutil
import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.noyau.medias import CACHE_MEDIAS_SECONDES, valider_video


class ServiceMediasTests(TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp(prefix="cir-medias-")
        self.addCleanup(shutil.rmtree, self.dossier, ignore_errors=True)
        (Path(self.dossier) / "essai.webp").write_bytes(b"RIFF0000WEBP")

    def test_fichier_servi_avec_cache(self):
        with override_settings(MEDIA_ROOT=self.dossier):
            r = self.client.get("/media/essai.webp")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r["Cache-Control"], f"public, max-age={CACHE_MEDIAS_SECONDES}")
            self.assertEqual(self.client.get("/media/absent.webp").status_code, 404)
            self.assertIn(self.client.get("/media/../manage.py").status_code, (400, 404))  # hors de MEDIA_ROOT


class ValiderVideoTests(SimpleTestCase):
    def test_formats(self):
        mp4 = SimpleUploadedFile("a.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 20)
        webm = SimpleUploadedFile("a.WEBM", b"\x1a\x45\xdf\xa3" + b"\x00" * 20)
        self.assertIs(valider_video(mp4), mp4)
        self.assertIs(valider_video(webm), webm)
        self.assertIsNone(valider_video(None))
        for fichier in (SimpleUploadedFile("a.avi", b"\x00" * 20), SimpleUploadedFile("a.mp4", b"pas une video"),
                        SimpleUploadedFile("a.webm", b"\x00\x00\x00\x18ftypmp42")):
            with self.subTest(nom=fichier.name), self.assertRaises(ValidationError):
                valider_video(fichier)

    def test_taille(self):
        mp4 = SimpleUploadedFile("a.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 100)
        with self.assertRaises(ValidationError) as contexte:
            valider_video(mp4, octets_max=50)
        self.assertIn("Mo", str(contexte.exception.detail[0]))
