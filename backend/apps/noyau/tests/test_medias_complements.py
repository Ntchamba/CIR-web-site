"""Service de /media/ : aucune sortie de MEDIA_ROOT, pas de liste des dossiers (revue backend-testeur, vague 1)."""
import shutil
import tempfile
from pathlib import Path

from django.test import TestCase, override_settings


class TraverseeMediasTests(TestCase):
    def setUp(self):
        racine = Path(tempfile.mkdtemp(prefix="cir-racine-"))
        self.addCleanup(shutil.rmtree, racine, ignore_errors=True)
        self.medias = racine / "media"
        (self.medias / "catalogue").mkdir(parents=True)
        (self.medias / "catalogue" / "photo.webp").write_bytes(b"RIFF0000WEBP")
        (racine / "secret.txt").write_text("DJANGO_SECRET_KEY=ne-pas-montrer")
        reglage = override_settings(MEDIA_ROOT=str(self.medias))
        reglage.enable()
        self.addCleanup(reglage.disable)

    def test_traversee_refusee(self):
        for chemin in ("/media/../secret.txt", "/media/%2e%2e/secret.txt", "/media/catalogue/..%2f..%2fsecret.txt",
                       "/media/..%5csecret.txt", "/media/%2e%2e%2fsecret.txt", "/media//etc/passwd",
                       f"/media/{self.medias.parent}/secret.txt"):
            with self.subTest(chemin=chemin):
                reponse = self.client.get(chemin)
                self.assertIn(reponse.status_code, (400, 404))
                self.assertNotIn(b"ne-pas-montrer", b"".join(getattr(reponse, "streaming_content", [reponse.content])))

    def test_pas_de_liste_des_dossiers(self):
        self.assertEqual(self.client.get("/media/catalogue/").status_code, 404)
        self.assertEqual(self.client.get("/media/").status_code, 404)

    def test_fichier_servi_avec_son_type(self):
        reponse = self.client.get("/media/catalogue/photo.webp")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse["Content-Type"], "image/webp")
        self.assertEqual(reponse["X-Content-Type-Options"], "nosniff")
