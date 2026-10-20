"""Téléchargement des pièces jointes : en-têtes et noms dangereux (compléments du testeur)."""
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.catalogue.tests.outils import image_png
from apps.messagerie import services
from apps.messagerie.models import PieceJointe
from apps.noyau.tests.outils_direct import BaseVague3
from apps.messagerie.tests.test_api import PDF, URL


class EntetesTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.conv = services.conversation_du_client(self.client_a)

    def piece(self, fichier):
        message = services.envoyer_message(self.conv, self.client_a, texte="", fichiers=[fichier])[0]
        return message.pieces_jointes.get()

    def get(self, piece, utilisateur=None):
        self.se_connecter(utilisateur or self.client_a)
        return self.client.get(f"{URL}pieces-jointes/{piece.pk}/")

    def test_nom_avec_retours_a_la_ligne_et_guillemets_sans_injection_d_en_tete(self):
        piece = self.piece(SimpleUploadedFile('x"\r\nSet-Cookie: a=b\r\n.pdf', PDF))
        r = self.get(piece)
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("\r", r["Content-Disposition"])
        self.assertNotIn("\n", r["Content-Disposition"])
        self.assertFalse(r.has_header("Set-Cookie"))
        self.assertNotIn("/", piece.nom_original)

    def test_en_tetes_de_securite(self):
        for fichier in (SimpleUploadedFile("a.pdf", PDF), image_png("b.png")):
            r = self.get(self.piece(fichier))
            self.assertEqual(r["X-Content-Type-Options"], "nosniff")
            self.assertIn("no-store", r["Cache-Control"])
            self.assertIn("sandbox", r["Content-Security-Policy"])
            self.assertNotIn("public", r["Cache-Control"])

    def test_pdf_toujours_en_telechargement_jamais_affiche(self):
        r = self.get(self.piece(SimpleUploadedFile("a.html", PDF)))  # extension trompeuse : seule la signature compte
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r["Content-Disposition"].startswith("attachment"))
        self.assertTrue(r["Content-Disposition"].count(".pdf") >= 1)

    def test_fichier_disparu_du_disque_donne_404(self):
        import os

        piece = self.piece(image_png())
        os.remove(piece.fichier.path)
        self.assertEqual(self.get(piece).status_code, 404)

    def test_identifiant_inconnu_ou_autre_client_meme_reponse(self):
        piece = self.piece(image_png())
        r_autre = self.get(piece, self.client_b)
        PieceJointe.objects.filter(pk=piece.pk).delete()
        r_inconnue = self.get(piece, self.client_b)
        self.assertEqual((r_autre.status_code, r_inconnue.status_code), (404, 404))
        self.assertEqual(r_autre.data, r_inconnue.data)
