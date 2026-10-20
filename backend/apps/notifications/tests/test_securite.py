"""Compléments du testeur : échappement HTML des modèles, langue des e-mails différés, accès aux envois."""
from datetime import timedelta

from django.utils import timezone

from apps.messagerie import services as messagerie
from apps.messagerie.models import Message
from apps.notifications import courriels, services, taches
from apps.notifications.models import EnvoiEmail, ModeleEmail
from apps.notifications.tests.test_evenements import BaseNotifications

ADMIN = "/api/admin/notifications/"


class EchappementTests(BaseNotifications):
    def test_introduction_d_un_modele_echappee_en_html_mais_pas_dans_le_texte(self):
        ModeleEmail.objects.create(evenement="commande_creee", langue="fr", sujet="Bonjour {nom}",
                                   introduction='<script>alert(1)</script> <a href="http://x">lien</a> {reference}')
        self.commande()
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertNotIn("<script>", mail.corps_html)
        self.assertNotIn('<a href="http://x">', mail.corps_html)
        self.assertIn("&lt;script&gt;", mail.corps_html)

    def test_apercu_echappe_le_html_saisi(self):
        mail = courriels.composer("commande_creee", self.client_a, {"reference": "CIR-1", "nom": "A"},
                                  sujet="S", introduction="<img src=x onerror=alert(1)>")
        self.assertNotIn("<img src=x", mail["html"])

    def test_variables_remplacees_par_du_texte_brut(self):
        self.client_a.nom_complet = "{reference} <b>Gras</b>"
        self.client_a.save()
        self.commande()
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertNotIn("<b>Gras</b>", mail.corps_html)

    def test_aucune_fuite_de_secret_dans_les_e_mails_sauf_lien_de_desabonnement(self):
        self.commande()
        for mail in EnvoiEmail.objects.all():
            self.assertNotIn("jeton=", mail.corps_html)
            self.assertNotIn("unsubscribe", str(mail.entetes).lower())


class MessageDiffereLangueTests(BaseNotifications):
    def test_email_de_message_dans_la_langue_du_destinataire(self):
        self.client_a.langue = "de"
        self.client_a.save()
        conv = messagerie.conversation_du_client(self.client_a)
        messagerie.envoyer_message(conv, self.membre, texte="Bonjour")
        Message.objects.update(cree_le=timezone.now() - timedelta(minutes=15))
        self.assertEqual(taches.preparer_emails_messages(), 1)
        mail = EnvoiEmail.objects.get()
        self.assertEqual(mail.sujet, "Neue Nachricht im CIR-Nachrichtenbereich")
        self.assertNotIn("Nouveau message", mail.sujet)


class AccesEnvoisTests(BaseNotifications):
    def test_un_membre_simple_et_un_client_n_accedent_ni_aux_envois_ni_aux_modeles(self):
        for utilisateur, attendu in ((self.client_a, 403), (self.membre, 403), (self.super_admin, 200)):
            self.se_connecter(utilisateur)
            for chemin in ("envois/", "envois/resume/", "modeles/"):
                with self.subTest(utilisateur=utilisateur.email, chemin=chemin):
                    self.assertEqual(self.client.get(ADMIN + chemin).status_code, attendu)
        self.se_connecter(self.membre)
        self.assertEqual(self.client.post(ADMIN + "modeles/apercu/", {"evenement": "commande_creee", "langue": "fr"},
                                          format="json").status_code, 403)
        self.assertEqual(self.client.delete(ADMIN + "modeles/commande_creee/fr/").status_code, 403)

    def test_adresse_masquee_dans_la_liste_des_envois(self):
        self.commande()
        self.se_connecter(self.super_admin)
        for ligne in self.client.get(ADMIN + "envois/").data["results"]:
            self.assertNotIn("exemple.cm", ligne["destinataire_email"].split("@")[0])
            self.assertIn("***@", ligne["destinataire_email"])
        self.assertEqual(services.masquer_email("pas-un-email"), "***")
