"""Règles métier de la messagerie : envoi, quotas, lecture, pagination, isolation, diffusion en direct."""
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.catalogue.tests.outils import image_png
from apps.commandes.tests.outils import creer_commande
from apps.messagerie import services
from apps.messagerie.models import Conversation, Message, PieceJointe
from apps.noyau.tests.outils_direct import BaseVague3


class Base(BaseVague3):
    def setUp(self):
        super().setUp()
        self.conv_a = services.conversation_du_client(self.client_a)

    def ecrire(self, auteur=None, texte="Bonjour", conversation=None, **plus):
        return services.envoyer_message(conversation or self.conv_a, auteur or self.client_a, texte=texte, **plus)[0]


class ConversationTests(Base):
    def test_une_seule_conversation_par_client(self):
        self.assertEqual(services.conversation_du_client(self.client_a).pk, self.conv_a.pk)
        self.assertEqual(Conversation.objects.filter(client=self.client_a).count(), 1)

    def test_equipe_ouvre_la_conversation_d_un_client(self):
        conversation, cree = services.ouvrir_conversation(self.client_b.pk)
        self.assertTrue(cree)
        self.assertEqual(services.ouvrir_conversation(self.client_b.pk), (conversation, False))

    def test_equipe_ne_peut_pas_ouvrir_une_conversation_pour_un_compte_equipe(self):
        with self.assertRaises(ValidationError):
            services.ouvrir_conversation(self.membre.pk)

    def test_un_client_ne_vise_que_sa_conversation(self):
        autre, _ = services.ouvrir_conversation(self.client_b.pk)
        with self.assertRaises(NotFound):
            services.conversation_pour(self.client_a, autre.pk)
        self.assertEqual(services.conversation_pour(self.client_a).pk, self.conv_a.pk)

    def test_l_equipe_doit_nommer_la_conversation(self):
        with self.assertRaises(NotFound):
            services.conversation_pour(self.membre)
        self.assertEqual(services.conversation_pour(self.membre, self.conv_a.pk).pk, self.conv_a.pk)


class EnvoiTests(Base):
    def test_message_du_client(self):
        message = self.ecrire(texte="  Bonjour l'équipe  ")
        self.assertEqual((message.auteur_role, message.texte, message.lu_le), ("client", "Bonjour l'équipe", None))
        self.conv_a.refresh_from_db()
        self.assertEqual(self.conv_a.dernier_message_le, message.cree_le)

    def test_message_de_l_equipe(self):
        message = self.ecrire(self.membre, "Nous vous répondons")
        self.assertEqual(message.auteur_role, "equipe")

    def test_message_vide_refuse_avec_son_code(self):
        with self.assertRaises(ValidationError) as ctx:
            self.ecrire(texte="   ")
        self.assertEqual(ctx.exception.detail["texte"][0].code, "message_vide")

    def test_message_trop_long_refuse(self):
        self.ecrire(texte="x" * 2000)
        with self.assertRaises(ValidationError) as ctx:
            self.ecrire(texte="x" * 2001)
        self.assertEqual(ctx.exception.detail["texte"][0].code, "trop_long")

    def test_texte_jamais_interprete(self):
        message = self.ecrire(texte="<script>alert(1)</script> {{ 7*7 }}")
        self.assertEqual(Message.objects.get(pk=message.pk).texte, "<script>alert(1)</script> {{ 7*7 }}")

    def test_caractere_nul_retire(self):
        self.assertEqual(self.ecrire(texte="a\x00b").texte, "ab")

    def test_cle_client_rejouee_ne_cree_pas_de_doublon(self):
        premier, cree = services.envoyer_message(self.conv_a, self.client_a, texte="Un", cle_client="abc")
        second, cree2 = services.envoyer_message(self.conv_a, self.client_a, texte="Un", cle_client="abc")
        self.assertEqual((cree, cree2, premier.pk), (True, False, second.pk))
        self.assertEqual(Message.objects.count(), 1)

    def test_cle_client_trop_longue(self):
        with self.assertRaises(ValidationError):
            self.ecrire(cle_client="x" * 65)

    def test_la_meme_cle_dans_deux_conversations_est_permise(self):
        autre, _ = services.ouvrir_conversation(self.client_b.pk)
        self.ecrire(cle_client="k")
        self.ecrire(self.client_b, conversation=autre, cle_client="k")
        self.assertEqual(Message.objects.count(), 2)

    def test_quota_de_30_messages_par_minute(self):
        for i in range(30):
            self.ecrire(texte=f"m{i}")
        with self.assertRaises(Exception) as ctx:
            self.ecrire(texte="de trop")
        self.assertEqual(ctx.exception.detail["code"], "trop_de_messages")
        self.assertEqual(ctx.exception.status_code, 429)
        Message.objects.update(cree_le=timezone.now() - timedelta(minutes=2))
        self.ecrire(texte="ça repasse")

    def test_le_quota_est_par_compte(self):
        for i in range(30):
            self.ecrire(texte=f"m{i}")
        self.ecrire(self.membre, "L'équipe n'est pas bloquée")

    def test_commande_du_client_seulement(self):
        produit = self.fabriquer_produit()
        commande_a = creer_commande(self.client_a, produit)
        commande_b = creer_commande(self.client_b, produit)
        message = self.ecrire(commande=commande_a.pk)
        self.assertEqual(message.commande_id, commande_a.pk)
        with self.assertRaises(ValidationError) as ctx:
            self.ecrire(texte="autre", commande=commande_b.pk)
        self.assertIn("commande", ctx.exception.detail)
        with self.assertRaises(ValidationError):
            self.ecrire(texte="abc", commande="pas un nombre")

    def fabriquer_produit(self):
        from apps.catalogue.models import Famille, Produit

        famille = Famille.objects.create(nom="Finitions")
        return Produit.objects.create(famille=famille, nom="Sol", reference="YD-500")

    def test_un_client_ne_peut_pas_ecrire_dans_la_conversation_d_un_autre(self):
        with self.assertRaises(Exception):
            services.envoyer_message(self.conv_a, self.client_b, texte="intrus")


class PiecesJointesEnvoiTests(Base):
    def test_fichiers_a_l_envoi(self):
        message = self.ecrire(texte="", fichiers=[image_png("a.png"), image_png("b.png")])
        self.assertEqual(message.pieces_jointes.count(), 2)

    def test_trois_pieces_au_plus(self):
        with self.assertRaises(ValidationError):
            self.ecrire(fichiers=[image_png(f"{i}.png") for i in range(4)])
        self.assertEqual(PieceJointe.objects.count(), 0)

    def test_un_fichier_refuse_n_en_ecrit_aucun(self):
        mauvais = SimpleUploadedFile("x.html", b"<html></html>")
        with self.assertRaises(ValidationError):
            self.ecrire(fichiers=[image_png(), mauvais])
        self.assertEqual((PieceJointe.objects.count(), Message.objects.count()), (0, 0))

    def test_pieces_deja_envoyees(self):
        piece = services.envoyer_piece(self.client_a, image_png())
        message = self.ecrire(texte="", pieces_ids=[piece.pk])
        piece.refresh_from_db()
        self.assertEqual(piece.message_id, message.pk)

    def test_piece_d_un_autre_compte_ou_deja_utilisee_refusee(self):
        piece = services.envoyer_piece(self.client_b, image_png())
        with self.assertRaises(ValidationError):
            self.ecrire(texte="", pieces_ids=[piece.pk])
        propre = services.envoyer_piece(self.client_a, image_png())
        self.ecrire(texte="", pieces_ids=[propre.pk])
        with self.assertRaises(ValidationError):
            self.ecrire(texte="", pieces_ids=[propre.pk])

    def test_message_vide_avec_piece_permis(self):
        self.assertEqual(self.ecrire(texte="", fichiers=[image_png()]).texte, "")


class LectureTests(Base):
    def test_lu_par_l_autre_partie_seulement(self):
        m1 = self.ecrire(self.membre, "1")
        m2 = self.ecrire(self.membre, "2")
        propre = self.ecrire(self.client_a, "à moi")
        non_lus = services.marquer_lu(self.conv_a, self.client_a, m1.pk)
        self.assertEqual(non_lus, 1)
        m1.refresh_from_db(), m2.refresh_from_db(), propre.refresh_from_db()
        self.assertIsNotNone(m1.lu_le)
        self.assertIsNone(m2.lu_le)
        self.assertIsNone(propre.lu_le)  # on ne marque jamais ses propres messages

    def test_compteurs_client_et_equipe(self):
        self.ecrire(self.client_a, "q1")
        self.ecrire(self.client_a, "q2")
        self.ecrire(self.membre, "r1")
        self.assertEqual(services.non_lus_client(self.client_a), 1)
        self.assertEqual(services.non_lus_equipe(), 2)
        self.assertEqual(services.compteur_non_lus(self.membre), 2)
        self.assertEqual(services.resume_equipe(), {"non_lus_total": 2, "conversations_non_lues": 1})

    def test_accuse_de_lecture_publie(self):
        message = self.ecrire(self.membre, "Salut")
        self.vider_publications()
        services.marquer_lu(self.conv_a, self.client_a, message.pk)
        attendu = {"conversation": self.conv_a.pk, "par": "client", "jusqu_a": message.pk}
        self.assertIn(("equipe", "lu", attendu), self.publications)

    def test_lecture_invalide(self):
        with self.assertRaises(ValidationError):
            services.marquer_lu(self.conv_a, self.client_a, "abc")

    def test_ecriture_signalee_a_l_autre_partie(self):
        services.signaler_ecriture(self.conv_a, self.client_a)
        self.assertEqual(self.trames("equipe", "ecrit")[0][2], {"conversation": self.conv_a.pk, "par": "client"})
        services.signaler_ecriture(self.conv_a, self.membre)
        self.assertEqual(self.trames(f"utilisateur_{self.client_a.pk}", "ecrit")[0][2]["par"], "equipe")


class PaginationTests(Base):
    def setUp(self):
        super().setUp()
        self.messages = [self.ecrire(self.client_a if i % 2 else self.membre, f"m{i}") for i in range(7)]
        Message.objects.update(cree_le=timezone.now() - timedelta(minutes=10))  # hors quota

    def ids(self, lot):
        return [m.pk for m in lot]

    def test_dernier_lot_du_plus_ancien_au_plus_recent(self):
        lot, a_plus = services.page_messages(self.conv_a, {"taille": "3"})
        self.assertEqual(self.ids(lot), self.ids(self.messages[4:]))
        self.assertTrue(a_plus)

    def test_avant_charge_l_historique(self):
        lot, a_plus = services.page_messages(self.conv_a, {"avant": str(self.messages[4].pk), "taille": "3"})
        self.assertEqual(self.ids(lot), self.ids(self.messages[1:4]))
        self.assertTrue(a_plus)
        lot, a_plus = services.page_messages(self.conv_a, {"avant": str(self.messages[1].pk), "taille": "3"})
        self.assertEqual(self.ids(lot), self.ids(self.messages[:1]))
        self.assertFalse(a_plus)

    def test_apres_rattrape_les_manques(self):
        lot, a_plus = services.page_messages(self.conv_a, {"apres": str(self.messages[2].pk), "taille": "2"})
        self.assertEqual(self.ids(lot), self.ids(self.messages[3:5]))
        self.assertTrue(a_plus)
        lot, a_plus = services.page_messages(self.conv_a, {"apres": str(self.messages[4].pk)})
        self.assertEqual(self.ids(lot), self.ids(self.messages[5:]))
        self.assertFalse(a_plus)

    def test_taille_par_defaut_et_plafond(self):
        lot, _ = services.page_messages(self.conv_a, {"taille": "5000"})
        self.assertEqual(len(lot), 7)
        lot, _ = services.page_messages(self.conv_a, {"taille": "0"})
        self.assertEqual(len(lot), 1)
        lot, _ = services.page_messages(self.conv_a, {"taille": "abc"})
        self.assertEqual(len(lot), 7)

    def test_une_conversation_ne_voit_pas_les_messages_d_une_autre(self):
        autre, _ = services.ouvrir_conversation(self.client_b.pk)
        self.ecrire(self.client_b, "privé", conversation=autre)
        lot, _ = services.page_messages(self.conv_a, {})
        self.assertNotIn("privé", [m.texte for m in lot])


class DiffusionTests(Base):
    def test_message_diffuse_au_client_et_a_toute_l_equipe(self):
        message = self.ecrire(self.client_a, "Bonjour")
        groupes = [g for g, t, d in self.publications if t == "message"]
        self.assertEqual(sorted(groupes), sorted([f"utilisateur_{self.client_a.pk}", "equipe"]))
        donnees = self.trames("equipe", "message")[0][2]["message"]
        self.assertEqual((donnees["id"], donnees["texte"], donnees["auteur_role"], donnees["auteur_nom"]),
                         (message.pk, "Bonjour", "client", "Alice Client"))
        self.assertEqual(set(donnees), {"id", "conversation", "auteur_role", "auteur_nom", "texte", "commande",
                                        "pieces_jointes", "cree_le", "lu_le", "cle_client"})

    def test_jamais_vers_un_autre_client(self):
        self.ecrire(self.client_a, "secret")
        self.assertEqual(self.trames(f"utilisateur_{self.client_b.pk}", "message"), [])

    def test_compteurs_pousses_au_client_et_a_chaque_membre(self):
        self.ecrire(self.membre, "Bonjour")
        destinataires = {g for g, t, d in self.publications if t == "non_lus"}
        self.assertEqual(destinataires, {f"utilisateur_{self.client_a.pk}", f"utilisateur_{self.membre.pk}",
                                         f"utilisateur_{self.super_admin.pk}"})
        valeurs = self.trames(f"utilisateur_{self.client_a.pk}", "non_lus")[-1][2]
        self.assertEqual(valeurs["messagerie"], 1)

    def test_lien_absolu_des_pieces_jointes(self):
        message = services.envoyer_message(self.conv_a, self.client_a, texte="", fichiers=[image_png()],
                                           base_url="https://api.exemple.cm")[0]
        piece = self.trames("equipe", "message")[0][2]["message"]["pieces_jointes"][0]
        self.assertEqual(piece["url"], f"https://api.exemple.cm/api/messagerie/pieces-jointes/{message.pieces_jointes.get().pk}/")
