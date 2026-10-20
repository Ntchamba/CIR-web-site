"""File d'envoi des e-mails : reprises, plafond, annulations, Gmail absent, e-mails des messages, commande."""
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from integrations.gmail.erreurs import GmailErreurDefinitive, GmailErreurTemporaire

from apps.messagerie import services as messagerie
from apps.messagerie.models import Message
from apps.noyau import presence
from apps.noyau.tests.outils_direct import BaseVague3
from apps.notifications import taches
from apps.notifications.models import EnvoiEmail


def fabriquer(destinataire="a@exemple.cm", utilisateur=None, **plus):
    valeurs = {"destinataire_email": destinataire, "utilisateur": utilisateur, "evenement": "commande_creee",
               "cle_unique": f"test:{EnvoiEmail.objects.count()}:{destinataire}", "sujet": "Sujet", "corps_texte": "Texte",
               "corps_html": "<p>Texte</p>", "entetes": {}, "prochaine_tentative": timezone.now() - timedelta(seconds=1)}
    valeurs.update(plus)
    return EnvoiEmail.objects.create(**valeurs)


class BaseTaches(BaseVague3):
    def setUp(self):
        super().setUp()
        self.configure = mock.patch.object(taches.gmail, "configure", return_value=True)
        self.configure_mock = self.configure.start()
        self.addCleanup(self.configure.stop)
        self.envoyer = mock.patch.object(taches.gmail, "envoyer", return_value="id-gmail-1")
        self.envoyer_mock = self.envoyer.start()
        self.addCleanup(self.envoyer.stop)


class EnvoiTests(BaseTaches):
    def test_envoi_reussi(self):
        envoi = fabriquer(utilisateur=self.client_a, entetes={"List-Unsubscribe": "<https://x>"})
        self.assertEqual(taches.traiter(envoi.pk), "envoye")
        envoi.refresh_from_db()
        self.assertEqual((envoi.etat, envoi.message_id, envoi.tentatives, envoi.derniere_erreur),
                         ("envoye", "id-gmail-1", 0, ""))
        self.assertIsNotNone(envoi.envoye_le)
        message = self.envoyer_mock.call_args.args[0]
        self.assertEqual((message.destinataire, message.sujet, message.texte, message.html),
                         ("a@exemple.cm", "Sujet", "Texte", "<p>Texte</p>"))
        self.assertEqual(message.entetes, {"List-Unsubscribe": "<https://x>"})

    def test_jamais_deux_fois(self):
        envoi = fabriquer()
        taches.traiter(envoi.pk)
        self.assertIsNone(taches.traiter(envoi.pk))
        self.assertEqual(self.envoyer_mock.call_count, 1)

    def test_pas_avant_l_heure_de_reprise(self):
        envoi = fabriquer(prochaine_tentative=timezone.now() + timedelta(minutes=5))
        self.assertIsNone(taches.traiter(envoi.pk))
        self.envoyer_mock.assert_not_called()

    def test_reprises_1_5_30_minutes_3_heures_puis_echec(self):
        self.envoyer_mock.side_effect = GmailErreurTemporaire("Service Gmail indisponible (code 503).")
        envoi = fabriquer()
        attendus = [timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30), timedelta(hours=3)]
        for numero, delai in enumerate(attendus, start=1):
            EnvoiEmail.objects.filter(pk=envoi.pk).update(prochaine_tentative=timezone.now() - timedelta(seconds=1))
            avant = timezone.now()
            self.assertEqual(taches.traiter(envoi.pk), "en_attente")
            envoi.refresh_from_db()
            self.assertEqual(envoi.tentatives, numero)
            ecart = envoi.prochaine_tentative - avant
            self.assertLess(abs(ecart - delai), timedelta(seconds=5))
            self.assertIn("503", envoi.derniere_erreur)
        EnvoiEmail.objects.filter(pk=envoi.pk).update(prochaine_tentative=timezone.now() - timedelta(seconds=1))
        self.assertEqual(taches.traiter(envoi.pk), "echec")
        envoi.refresh_from_db()
        self.assertEqual((envoi.etat, envoi.tentatives), ("echec", 5))

    def test_erreur_definitive_echec_tout_de_suite(self):
        self.envoyer_mock.side_effect = GmailErreurDefinitive("Envoi refusé par Gmail (code 400).")
        envoi = fabriquer()
        self.assertEqual(taches.traiter(envoi.pk), "echec")
        envoi.refresh_from_db()
        self.assertEqual((envoi.tentatives, envoi.derniere_erreur), (1, "Envoi refusé par Gmail (code 400)."))

    def test_erreur_inattendue_traitee_comme_temporaire_sans_detail(self):
        self.envoyer_mock.side_effect = RuntimeError("secret-token-123")
        envoi = fabriquer()
        with self.assertLogs("cir.notifications", level="ERROR"):
            self.assertEqual(taches.traiter(envoi.pk), "en_attente")
        envoi.refresh_from_db()
        self.assertNotIn("secret-token-123", envoi.derniere_erreur)
        self.assertEqual(envoi.tentatives, 1)

    def test_gmail_non_configure_les_lignes_restent_en_attente_sans_tentative(self):
        self.configure_mock.return_value = False
        envoi = fabriquer()
        self.assertEqual(taches.traiter(envoi.pk), "en_attente")
        envoi.refresh_from_db()
        self.assertEqual((envoi.etat, envoi.tentatives), ("en_attente", 0))
        self.envoyer_mock.assert_not_called()

    @override_settings(DEBUG=True)
    def test_en_developpement_l_email_s_affiche_dans_la_console(self):
        self.configure_mock.return_value = False
        envoi = fabriquer()
        with self.assertLogs("cir.notifications", level="WARNING") as journal:
            self.assertEqual(taches.traiter(envoi.pk), "envoye")
        self.assertIn("Sujet", journal.output[0])
        envoi.refresh_from_db()
        self.assertEqual(envoi.message_id, "console")

    def test_destinataire_invalide_ou_compte_desactive_annule(self):
        invalide = fabriquer("pas-une-adresse")
        injecte = fabriquer("x@exemple.cm\r\nBcc: y@z.cm")
        self.client_a.is_active = False
        self.client_a.save()
        desactive = fabriquer(utilisateur=self.client_a)
        for envoi in (invalide, injecte, desactive):
            self.assertEqual(taches.traiter(envoi.pk), "annule")
        self.envoyer_mock.assert_not_called()

    @override_settings(GMAIL_LIMITE_JOUR=2)
    def test_plafond_journalier(self):
        envois = [fabriquer(f"u{i}@exemple.cm") for i in range(4)]
        self.assertEqual(taches.envoyer_en_attente(), 2)
        self.assertEqual(EnvoiEmail.objects.filter(etat="envoye").count(), 2)
        self.assertEqual(EnvoiEmail.objects.filter(etat="en_attente").count(), 2)
        self.assertEqual(taches.traiter(envois[3].pk), "en_attente")  # même en direct, le plafond tient
        # le lendemain, les envois restants partent
        EnvoiEmail.objects.filter(etat="envoye").update(envoye_le=timezone.now() - timedelta(days=1))
        self.assertEqual(taches.envoyer_en_attente(), 2)

    def test_ordre_et_lot(self):
        for i in range(5):
            fabriquer(f"u{i}@exemple.cm")
        self.assertEqual(taches.envoyer_en_attente(limite=3), 3)
        self.assertEqual(self.envoyer_mock.call_args_list[0].args[0].destinataire, "u0@exemple.cm")

    def test_ligne_verrouillee_par_un_autre_processus_ignoree(self):
        """`skip_locked` : une ligne déjà prise est sautée (le verrou lui-même est une garantie de PostgreSQL)."""
        envoi = fabriquer()
        with mock.patch("django.db.models.query.QuerySet.select_for_update", autospec=True,
                        side_effect=lambda self, **kw: (self if kw.get("skip_locked") is True else 1/0)) as s:
            taches.traiter(envoi.pk)
        self.assertTrue(s.called)

    def test_traiter_sans_erreur_journalise(self):
        with mock.patch.object(taches, "traiter", side_effect=RuntimeError("base coupée")), \
                self.assertLogs("cir.notifications", level="ERROR"):
            self.assertIsNone(taches.traiter_sans_erreur(1))


class MessagesDifferesTests(BaseTaches):
    def setUp(self):
        super().setUp()
        self.conv = messagerie.conversation_du_client(self.client_a)

    def vieillir(self, minutes):
        Message.objects.update(cree_le=timezone.now() - timedelta(minutes=minutes))

    def test_pas_d_email_avant_10_minutes(self):
        messagerie.envoyer_message(self.conv, self.membre, texte="Bonjour")
        self.vieillir(9)
        self.assertEqual(taches.preparer_emails_messages(), 0)

    def test_email_apres_10_minutes_au_client_hors_ligne(self):
        messagerie.envoyer_message(self.conv, self.membre, texte="Bonjour")
        self.vieillir(11)
        self.assertEqual(taches.preparer_emails_messages(), 1)
        mail = EnvoiEmail.objects.get()
        self.assertEqual((mail.destinataire_email, mail.evenement), ("a@exemple.cm", "message_nouveau"))
        self.assertNotIn("Bonjour", mail.corps_texte)  # le contenu du message ne part jamais par e-mail

    def test_client_en_ligne_pas_d_email(self):
        messagerie.envoyer_message(self.conv, self.membre, texte="Bonjour")
        self.vieillir(30)
        presence.marquer_en_ligne(self.client_a)
        self.assertEqual(taches.preparer_emails_messages(), 0)

    def test_message_lu_entre_temps_rien(self):
        message = messagerie.envoyer_message(self.conv, self.membre, texte="Bonjour")[0]
        self.vieillir(30)
        messagerie.marquer_lu(self.conv, self.client_a, message.pk)
        self.assertEqual(taches.preparer_emails_messages(), 0)

    def test_un_email_par_conversation_et_par_heure(self):
        messagerie.envoyer_message(self.conv, self.membre, texte="Un")
        self.vieillir(11)
        self.assertEqual(taches.preparer_emails_messages(), 1)
        self.assertEqual(taches.preparer_emails_messages(), 0)  # rien de nouveau
        messagerie.envoyer_message(self.conv, self.membre, texte="Deux")
        self.vieillir(11)
        self.assertEqual(taches.preparer_emails_messages(), 0)  # moins d'une heure
        EnvoiEmail.objects.update(cree_le=timezone.now() - timedelta(hours=2))
        self.assertEqual(taches.preparer_emails_messages(), 1)
        self.assertEqual(taches.preparer_emails_messages(), 0)  # plus aucun message neuf

    def test_equipe_seulement_si_hors_ligne_et_email_equipe(self):
        messagerie.envoyer_message(self.conv, self.client_a, texte="Bonjour")
        self.vieillir(20)
        presence.marquer_en_ligne(self.membre)
        self.super_admin.email_equipe = False
        self.super_admin.save()
        self.assertEqual(taches.preparer_emails_messages(), 0)
        self.membre.email_equipe = True
        from django.core.cache import cache

        cache.clear()
        self.assertEqual(taches.preparer_emails_messages(), 1)
        self.assertEqual(EnvoiEmail.objects.get().destinataire_email, "membre@cir.cm")


class CommandesTests(BaseTaches):
    def test_une_passe(self):
        from apps.notifications.management.commands.envoyer_emails import une_passe

        fabriquer()
        self.assertEqual(une_passe(), 1)

    def test_une_etape_en_panne_n_arrete_pas_les_suivantes(self):
        from apps.notifications.management.commands import envoyer_emails

        fabriquer()
        with mock.patch.object(taches, "notifier_actualites", side_effect=RuntimeError), \
                self.assertLogs("cir.notifications", level="ERROR"):
            self.assertEqual(envoyer_emails.une_passe(), 1)

    def test_commande_envoyer_emails(self):
        fabriquer()
        sortie = StringIO()
        call_command("envoyer_emails", stdout=sortie)
        self.assertIn("1 e-mail(s) envoyé(s)", sortie.getvalue())

    def test_boucle_s_arrete_sur_demande(self):
        from apps.notifications.management.commands import envoyer_emails

        appels = []

        def une_passe_puis_arret():
            appels.append(1)
            import signal
            import os

            os.kill(os.getpid(), signal.SIGTERM)
            return 0

        with mock.patch.object(envoyer_emails, "une_passe", side_effect=une_passe_puis_arret), \
                mock.patch.object(envoyer_emails.time, "sleep"):
            call_command("envoyer_emails", boucle=True, pause=3, stdout=StringIO())
        self.assertEqual(len(appels), 1)

    def test_commande_notifier_actualites(self):
        sortie = StringIO()
        call_command("notifier_actualites", stdout=sortie)
        self.assertIn("0 actualité(s)", sortie.getvalue())

    def test_commande_purger_pieces_jointes(self):
        sortie = StringIO()
        call_command("purger_pieces_jointes", stdout=sortie)
        self.assertIn("0 pièce(s)", sortie.getvalue())
