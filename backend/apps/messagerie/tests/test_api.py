"""API de la messagerie : client (/api/messagerie/), équipe (/api/admin/messagerie/), pièces jointes privées."""
import os
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from apps.catalogue.tests.outils import image_png
from apps.messagerie import services
from apps.messagerie.models import PieceJointe
from apps.messagerie.pieces_jointes import nettoyer_nom, purger_non_rattachees
from apps.noyau.tests.outils_direct import BaseVague3

URL = "/api/messagerie/"
ADMIN = "/api/admin/messagerie/"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


class ClientTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.client_a)

    def poster(self, **donnees):
        return self.client.post(URL + "messages/", donnees, format="json")

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL + "conversation/").status_code, 401)
        self.client.force_authenticate(self.membre)
        r = self.client.get(URL + "messages/")
        self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))

    def test_conversation_creee_a_la_demande(self):
        r = self.client.get(URL + "conversation/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.data["non_lus"], r.data["dernier_message"]), (0, None))
        self.assertEqual(self.client.get(URL + "conversation/").data["id"], r.data["id"])

    def test_envoi_et_lecture(self):
        r = self.poster(texte="Bonjour", cle_client="k1")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["texte"], r.data["auteur_role"], r.data["cle_client"]), ("Bonjour", "client", "k1"))
        rejoue = self.poster(texte="Bonjour", cle_client="k1")
        self.assertEqual((rejoue.status_code, rejoue.data["id"]), (200, r.data["id"]))
        liste = self.client.get(URL + "messages/")
        self.assertEqual([m["id"] for m in liste.data["results"]], [r.data["id"]])
        self.assertFalse(liste.data["a_plus"])
        self.assertEqual(self.client.get(URL + "conversation/").data["dernier_message"]["id"], r.data["id"])

    def test_message_vide_400(self):
        self.assertEqual(self.poster(texte="  ").status_code, 400)
        self.assertEqual(self.poster().status_code, 400)

    def test_message_trop_long_400(self):
        self.assertEqual(self.poster(texte="x" * 2001).status_code, 400)

    def test_quota_429_avec_code(self):
        for i in range(30):
            self.poster(texte=f"m{i}")
        r = self.poster(texte="de trop")
        self.assertEqual((r.status_code, r.data["code"]), (429, "trop_de_messages"))

    def test_envoi_multipart_avec_fichiers(self):
        r = self.client.post(URL + "messages/", {"texte": "Voici", "fichiers": [image_png("p.png"),
                             SimpleUploadedFile("devis.pdf", PDF)]}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        types = sorted(p["type"] for p in r.data["pieces_jointes"])
        self.assertEqual(types, ["document", "image"])
        self.assertTrue(r.data["pieces_jointes"][0]["url"].startswith("http://testserver/api/messagerie/pieces-jointes/"))

    def test_piece_jointe_en_deux_temps(self):
        r = self.client.post(URL + "pieces-jointes/", {"fichier": image_png("a.png")}, format="multipart")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(set(r.data), {"id", "nom_original", "type", "taille", "url"})
        m = self.poster(pieces_jointes=[r.data["id"]])
        self.assertEqual(m.status_code, 201)
        self.assertEqual(m.data["pieces_jointes"][0]["id"], r.data["id"])

    def test_piece_jointe_sans_fichier_400(self):
        self.assertEqual(self.client.post(URL + "pieces-jointes/", {}, format="multipart").status_code, 400)

    def test_lu_et_non_lus(self):
        m = services.envoyer_message(services.conversation_du_client(self.client_a), self.membre, texte="Salut")[0]
        self.assertEqual(self.client.get(URL + "non-lus/").data, {"non_lus": 1})
        r = self.client.post(URL + "lu/", {"jusqu_a": m.pk}, format="json")
        self.assertEqual(r.data, {"non_lus": 0})
        self.assertEqual(self.client.post(URL + "lu/", {}, format="json").status_code, 400)

    def test_historique_avant_apres(self):
        conv = services.conversation_du_client(self.client_a)
        ids = [services.envoyer_message(conv, self.membre, texte=f"m{i}")[0].pk for i in range(5)]
        r = self.client.get(URL + "messages/?taille=2")
        self.assertEqual([m["id"] for m in r.data["results"]], ids[3:])
        self.assertTrue(r.data["a_plus"])
        r = self.client.get(URL + f"messages/?avant={ids[3]}&taille=2")
        self.assertEqual([m["id"] for m in r.data["results"]], ids[1:3])
        r = self.client.get(URL + f"messages/?apres={ids[2]}")
        self.assertEqual([m["id"] for m in r.data["results"]], ids[3:])

    def test_isolation_entre_clients(self):
        self.poster(texte="de A")
        self.se_connecter(self.client_b)
        self.assertEqual(self.client.get(URL + "messages/").data["results"], [])


class PiecesJointesTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.conv = services.conversation_du_client(self.client_a)
        self.message = services.envoyer_message(self.conv, self.client_a, texte="", fichiers=[image_png("secret.png")])[0]
        self.piece = self.message.pieces_jointes.get()

    def telecharger(self, utilisateur, piece=None, admin=False):
        self.client.force_authenticate(utilisateur)
        return self.client.get(f"{ADMIN if admin else URL}pieces-jointes/{(piece or self.piece).pk}/")

    def test_telechargement_par_le_client_et_l_equipe(self):
        r = self.telecharger(self.client_a)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "image/webp")
        self.assertEqual(r["X-Content-Type-Options"], "nosniff")
        self.assertIn("no-store", r["Cache-Control"])
        self.assertIn("private", r["Cache-Control"])
        self.assertIn('filename="secret.webp"', r["Content-Disposition"])
        contenu = b"".join(r.streaming_content)
        self.assertEqual(Image.open(BytesIO(contenu)).format, "WEBP")
        self.assertEqual(self.telecharger(self.membre).status_code, 200)
        self.assertEqual(self.telecharger(self.membre, admin=True).status_code, 200)

    def test_un_autre_client_recoit_404(self):
        self.assertEqual(self.telecharger(self.client_b).status_code, 404)

    def test_sans_jeton_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{URL}pieces-jointes/{self.piece.pk}/").status_code, 401)

    def test_piece_non_rattachee_visible_par_son_auteur_seulement(self):
        piece = services.envoyer_piece(self.client_a, image_png())
        self.assertEqual(self.telecharger(self.client_a, piece).status_code, 200)
        self.assertEqual(self.telecharger(self.membre, piece).status_code, 404)

    def test_pdf_en_telechargement(self):
        message = services.envoyer_message(self.conv, self.client_a, texte="",
                                           fichiers=[SimpleUploadedFile("../../etc/Devis.pdf", PDF)])[0]
        r = self.telecharger(self.client_a, message.pieces_jointes.get())
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r["Content-Disposition"].startswith("attachment"))
        self.assertEqual(message.pieces_jointes.get().nom_original, "Devis.pdf")

    def test_fichier_hors_de_media(self):
        from django.conf import settings

        chemin = self.piece.fichier.path
        self.assertTrue(chemin.startswith(self.dossier_prive))
        self.assertFalse(chemin.startswith(str(settings.MEDIA_ROOT)))
        self.assertRegex(os.path.basename(chemin), r"^[0-9a-f]{32}\.webp$")  # nom aléatoire, jamais celui envoyé
        with self.assertRaises(ValueError):
            self.piece.fichier.url
        self.assertEqual(self.client.get("/media/" + self.piece.fichier.name).status_code, 404)

    def test_types_refuses_par_signature(self):
        faux = {
            "html": SimpleUploadedFile("page.png", b"<html><script>alert(1)</script></html>", content_type="image/png"),
            "svg": SimpleUploadedFile("a.svg", b'<svg xmlns="http://www.w3.org/2000/svg"/>', content_type="image/svg+xml"),
            "exe": SimpleUploadedFile("a.pdf", b"MZ\x90\x00" + b"\0" * 20, content_type="application/pdf"),
            "zip": SimpleUploadedFile("a.jpg", b"PK\x03\x04" + b"\0" * 20),
            "script": SimpleUploadedFile("a.sh", b"#!/bin/sh\nrm -rf /\n"),
            "vide": SimpleUploadedFile("vide.png", b""),
        }
        self.client.force_authenticate(self.client_a)
        for nom, fichier in faux.items():
            with self.subTest(nom):
                r = self.client.post(URL + "pieces-jointes/", {"fichier": fichier}, format="multipart")
                self.assertEqual(r.status_code, 400)
                self.assertIn("fichier", r.data)
        r = self.client.post(URL + "messages/", {"texte": "x", "fichiers": [faux["html"]]}, format="multipart")
        self.assertIn("fichiers", r.data)

    def test_image_corrompue_avec_bonne_signature_refusee(self):
        self.client.force_authenticate(self.client_a)
        r = self.client.post(URL + "pieces-jointes/", {"fichier": SimpleUploadedFile("a.png", b"\x89PNG\r\n\x1a\n" + b"x" * 30)},
                             format="multipart")
        self.assertEqual(r.status_code, 400)

    def test_fichier_trop_lourd(self):
        self.client.force_authenticate(self.client_a)
        gros = SimpleUploadedFile("gros.pdf", PDF + b"0" * (10 * 1024 * 1024))
        self.assertEqual(self.client.post(URL + "pieces-jointes/", {"fichier": gros}, format="multipart").status_code, 400)

    def test_images_reduites_a_1600_px(self):
        tampon = BytesIO()
        Image.new("RGB", (3200, 800), "#1177A8").save(tampon, "JPEG")
        message = services.envoyer_message(self.conv, self.client_a, texte="",
                                           fichiers=[SimpleUploadedFile("grand.jpg", tampon.getvalue())])[0]
        with Image.open(message.pieces_jointes.get().fichier.path) as image:
            self.assertEqual(image.size, (1600, 400))

    def test_dix_pieces_en_attente_au_plus(self):
        self.client.force_authenticate(self.client_b)
        for _ in range(10):
            self.assertEqual(self.client.post(URL + "pieces-jointes/", {"fichier": image_png()}, format="multipart").status_code, 201)
        self.assertEqual(self.client.post(URL + "pieces-jointes/", {"fichier": image_png()}, format="multipart").status_code, 400)

    def test_nettoyage_du_nom(self):
        self.assertEqual(nettoyer_nom("C:\\dossier\\..\\photo\x00.png"), "photo.png")
        self.assertEqual(nettoyer_nom("/etc/passwd"), "passwd")
        self.assertEqual(nettoyer_nom("a\u202egpj.exe"), "agpj.exe")  # caractère de mise en forme retiré
        self.assertEqual(nettoyer_nom(""), "fichier")
        self.assertLessEqual(len(nettoyer_nom("x" * 400 + ".pdf")), 150)
        self.assertTrue(nettoyer_nom("x" * 400 + ".pdf").endswith(".pdf"))

    def test_purge_des_pieces_orphelines(self):
        vieille = services.envoyer_piece(self.client_b, image_png())
        recente = services.envoyer_piece(self.client_b, image_png())
        from datetime import timedelta

        from django.utils import timezone

        PieceJointe.objects.filter(pk=vieille.pk).update(cree_le=timezone.now() - timedelta(hours=25))
        chemin = vieille.fichier.path
        self.assertEqual(purger_non_rattachees(), 1)
        self.assertFalse(PieceJointe.objects.filter(pk=vieille.pk).exists())
        self.assertFalse(os.path.exists(chemin))
        self.assertTrue(PieceJointe.objects.filter(pk=recente.pk).exists())
        self.assertTrue(PieceJointe.objects.filter(pk=self.piece.pk).exists())  # rattachée : jamais purgée


class EquipeTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.conv_a = services.conversation_du_client(self.client_a)
        self.conv_b = services.conversation_du_client(self.client_b)
        self.m1 = services.envoyer_message(self.conv_a, self.client_a, texte="Question d'Alice")[0]
        self.m2 = services.envoyer_message(self.conv_b, self.client_b, texte="x" * 300)[0]
        self.se_connecter(self.membre)

    def test_acces_reserve_a_l_equipe(self):
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(ADMIN + "conversations/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(ADMIN + "resume/").status_code, 401)

    def test_liste_des_conversations(self):
        r = self.client.get(ADMIN + "conversations/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        premiere = r.data["results"][0]  # activité la plus récente d'abord
        self.assertEqual(premiere["id"], self.conv_b.pk)
        self.assertEqual(premiere["client"], {"id": self.client_b.pk, "nom_complet": "Bruno Client",
                                              "email": "b@exemple.cm", "telephone": "", "langue": "fr"})
        self.assertEqual(len(premiere["dernier_message"]["texte"]), 120)
        self.assertEqual((premiere["dernier_message"]["auteur_role"], premiere["non_lus"]), ("client", 1))

    def test_filtres(self):
        services.marquer_lu(self.conv_a, self.membre, self.m1.pk)
        r = self.client.get(ADMIN + "conversations/?non_lus=1")
        self.assertEqual([c["id"] for c in r.data["results"]], [self.conv_b.pk])
        r = self.client.get(ADMIN + "conversations/?search=alice")
        self.assertEqual([c["id"] for c in r.data["results"]], [self.conv_a.pk])
        r = self.client.get(ADMIN + "conversations/?search=b@exemple")
        self.assertEqual([c["id"] for c in r.data["results"]], [self.conv_b.pk])

    def test_ouvrir_une_conversation(self):
        r = self.client.post(ADMIN + "conversations/", {"client": self.client_a.pk}, format="json")
        self.assertEqual((r.status_code, r.data["id"]), (200, self.conv_a.pk))
        neuf = self.creer_client_sans_conversation()
        r = self.client.post(ADMIN + "conversations/", {"client": neuf.pk}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post(ADMIN + "conversations/", {"client": self.membre.pk}, format="json").status_code, 400)
        self.assertEqual(self.client.post(ADMIN + "conversations/", {}, format="json").status_code, 400)

    def creer_client_sans_conversation(self):
        from apps.catalogue.tests.outils import creer_client

        return creer_client("neuf@exemple.cm", "Nina Neuve")

    def test_messages_envoi_et_lu(self):
        r = self.client.get(f"{ADMIN}conversations/{self.conv_a.pk}/messages/")
        self.assertEqual([m["texte"] for m in r.data["results"]], ["Question d'Alice"])
        r = self.client.post(f"{ADMIN}conversations/{self.conv_a.pk}/messages/", {"texte": "Réponse"}, format="json")
        self.assertEqual((r.status_code, r.data["auteur_role"], r.data["auteur_nom"]), (201, "equipe", "Membre CIR"))
        r = self.client.post(f"{ADMIN}conversations/{self.conv_a.pk}/lu/", {"jusqu_a": self.m1.pk}, format="json")
        self.assertEqual(r.data, {"non_lus": 1})  # reste la conversation de Bruno
        self.assertEqual(self.client.get(ADMIN + "resume/").data, {"non_lus_total": 1, "conversations_non_lues": 1})

    def test_conversation_inconnue_404(self):
        self.assertEqual(self.client.get(ADMIN + "conversations/9999/messages/").status_code, 404)

    def test_l_equipe_peut_envoyer_une_piece(self):
        r = self.client.post(ADMIN + "pieces-jointes/", {"fichier": image_png()}, format="multipart")
        self.assertEqual(r.status_code, 201)
        m = self.client.post(f"{ADMIN}conversations/{self.conv_a.pk}/messages/", {"pieces_jointes": [r.data["id"]]},
                             format="json")
        self.assertEqual(m.status_code, 201)
        self.se_connecter(self.client_a)  # le client de la conversation voit la pièce
        self.assertEqual(self.client.get(f"{URL}pieces-jointes/{r.data['id']}/").status_code, 200)
