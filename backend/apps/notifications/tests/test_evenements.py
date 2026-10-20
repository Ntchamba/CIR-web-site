"""Notifications : qui reçoit quoi, langue, préférences, panne sans conséquence, nouveautés."""
from datetime import timedelta
from unittest import mock

from django.test import override_settings
from django.utils import timezone, translation

from apps.actualites.models import Actualite
from apps.catalogue.models import Famille, Produit
from apps.commandes import services as commandes
from apps.commandes.tests.outils import creer_commande
from apps.contact import services as contact
from apps.devis import services as devis_services
from apps.devis.models import DemandeRendu, Devis, LigneDevis
from apps.messagerie import services as messagerie
from apps.noyau.tests.outils_direct import BaseVague3
from apps.notifications import receivers, services, taches
from apps.notifications.models import EnvoiEmail, ModeleEmail, Notification


@override_settings(NOTIFICATIONS_ENVOI_IMMEDIAT=False, SITE_URL="https://site.exemple.cm",
                   ADMIN_URL_PUBLIQUE="https://admin.exemple.cm", API_URL_PUBLIQUE="https://api.exemple.cm")
class BaseNotifications(BaseVague3):
    def setUp(self):
        super().setUp()
        self.produit = Produit.objects.create(famille=Famille.objects.create(nom="Finitions"), nom="Sol autolissant",
                                              reference="YD-500")

    def types(self, utilisateur):
        return list(Notification.objects.filter(utilisateur=utilisateur).order_by("id").values_list("type", flat=True))

    def commande(self, client=None, **plus):
        return creer_commande(client or self.client_a, self.produit, **{"surface_m2": "20", **plus})


class CommandeTests(BaseNotifications):
    def test_commande_creee(self):
        commande = self.commande()
        self.assertEqual(self.types(self.client_a), ["commande_creee"])
        for membre in (self.membre, self.super_admin):
            self.assertEqual(self.types(membre), ["commande_nouvelle"])
        self.assertEqual(self.types(self.client_b), [])
        notification = Notification.objects.get(utilisateur=self.client_a)
        self.assertEqual(notification.donnees["commande"], commande.pk)
        mails = EnvoiEmail.objects.order_by("id")
        self.assertEqual(mails.count(), 3)  # le client + les deux membres de l'équipe
        client_mail = mails.get(destinataire_email="a@exemple.cm")
        self.assertIn(commande.reference, client_mail.sujet)
        self.assertIn(f"https://site.exemple.cm/commandes/{commande.pk}", client_mail.corps_texte)
        self.assertEqual(client_mail.etat, "en_attente")
        equipe_mail = mails.get(destinataire_email="membre@cir.cm")
        self.assertIn(f"https://admin.exemple.cm/commandes/{commande.pk}", equipe_mail.corps_texte)
        self.assertNotIn("https://site.exemple.cm", equipe_mail.corps_html)

    def test_notification_poussee_en_direct_avec_compteurs(self):
        self.commande()
        trame = self.trames(f"utilisateur_{self.client_a.pk}", "notification")[0][2]["notification"]
        self.assertEqual(set(trame), {"id", "type", "titre", "texte", "lien", "lue", "cree_le"})
        self.assertEqual(trame["type"], "commande_creee")
        compteurs = self.trames(f"utilisateur_{self.client_a.pk}", "non_lus")[-1][2]
        self.assertEqual(compteurs, {"messagerie": 0, "notifications": 1})

    def test_equipe_sans_email_equipe_garde_l_application_seulement(self):
        self.membre.email_equipe = False
        self.membre.save()
        self.commande()
        self.assertEqual(self.types(self.membre), ["commande_nouvelle"])
        self.assertFalse(EnvoiEmail.objects.filter(destinataire_email="membre@cir.cm").exists())
        self.assertTrue(EnvoiEmail.objects.filter(destinataire_email="super@cir.cm").exists())

    def test_langue_de_l_email_est_celle_du_destinataire(self):
        self.client_a.langue = "en"
        self.client_a.save()
        self.commande()
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertIn("is recorded", mail.sujet)
        self.assertIn("Hello Alice Client", mail.corps_texte)
        self.assertIn("View on the website", mail.corps_texte)
        equipe = EnvoiEmail.objects.get(destinataire_email="membre@cir.cm")
        self.assertTrue(equipe.sujet.startswith("Nouvelle commande"))  # le membre est en français

    def test_langues_chinois_allemand_japonais(self):
        for langue, extrait in (("zh", "已登记"), ("de", "erfasst"), ("ja", "受け付けました")):
            with self.subTest(langue=langue):
                self.client_a.langue = langue
                self.client_a.save()
                commande = self.commande()
                self.assertIn(extrait, EnvoiEmail.objects.get(cle_unique=f"commande_creee:{commande.pk}:{self.client_a.pk}").sujet)

    def test_modele_enregistre_remplace_sujet_et_introduction(self):
        ModeleEmail.objects.create(evenement="commande_creee", langue="fr", sujet="Reçu : {reference}",
                                   introduction="Merci {nom} !")
        commande = self.commande()
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertEqual(mail.sujet, f"Reçu : {commande.reference}")
        self.assertIn("Merci Alice Client !", mail.corps_texte)
        self.assertIn(commande.reference, mail.corps_texte)  # la référence reste fixée par le code

    def test_contenu_utilisateur_echappe_dans_le_html(self):
        self.client_a.nom_complet = '<img src=x onerror="alert(1)"> & Cie'
        self.client_a.save()
        self.commande()
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertNotIn("<img", mail.corps_html)
        self.assertIn("&lt;img src=x", mail.corps_html)

    def test_sujet_sans_retour_a_la_ligne(self):
        ModeleEmail.objects.create(evenement="commande_creee", langue="fr", sujet="Ligne 1\r\nBcc: x@y.z",
                                   introduction="ok")
        self.commande()
        self.assertNotIn("\n", EnvoiEmail.objects.get(destinataire_email="a@exemple.cm").sujet)

    def test_sans_email_valide_ou_compte_inactif_pas_de_mail(self):
        self.client_a.is_active = False
        self.client_a.save()
        self.assertFalse(services.peut_recevoir_email(self.client_a, "commande_creee"))


class NegociationTests(BaseNotifications):
    def setUp(self):
        super().setUp()
        self.commande_ = self.commande()
        Notification.objects.all().delete()
        EnvoiEmail.objects.all().delete()

    def test_proposition_de_l_equipe_vers_le_client(self):
        commandes.proposer(self.commande_, self.membre, "equipe", {"prix_m2": 12000})
        self.assertEqual(self.types(self.client_a), ["proposition_recue"])
        self.assertEqual(self.types(self.membre), [])
        self.assertEqual(EnvoiEmail.objects.get().destinataire_email, "a@exemple.cm")

    def test_contre_proposition_du_client_vers_l_equipe(self):
        commandes.proposer(self.commande_, self.membre, "equipe", {"prix_m2": 12000})
        Notification.objects.all().delete()
        commandes.proposer(self.commande_, self.client_a, "client", {"prix_m2": 10000})
        self.assertEqual(self.types(self.client_a), [])
        self.assertEqual(self.types(self.membre), ["proposition_client"])
        self.assertEqual(self.types(self.super_admin), ["proposition_client"])

    def test_refus_par_le_client(self):
        proposition = commandes.proposer(self.commande_, self.membre, "equipe", {"prix_m2": 12000})
        Notification.objects.all().delete()
        commandes.repondre(proposition, self.client_a, "client", accepter=False)
        self.assertEqual(self.types(self.membre), ["proposition_client"])

    def test_refus_par_l_equipe(self):
        proposition = commandes.proposer(self.commande_, self.client_a, "client", {"prix_m2": 9000})
        Notification.objects.all().delete()
        commandes.repondre(proposition, self.membre, "equipe", accepter=False)
        self.assertEqual(self.types(self.client_a), ["proposition_recue"])

    def test_acceptation_signe_le_contrat_pour_le_client_et_l_equipe(self):
        proposition = commandes.proposer(self.commande_, self.membre, "equipe", {"prix_m2": 12000})
        Notification.objects.all().delete()
        EnvoiEmail.objects.all().delete()
        commandes.repondre(proposition, self.client_a, "client", accepter=True)
        self.assertEqual(self.types(self.client_a), ["contrat_signe"])
        self.assertEqual(self.types(self.membre), ["contrat_signe"])
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertIn("240", mail.corps_texte)  # montant convenu : 12000 × 20 m²
        self.assertIn("FCFA", mail.corps_texte)

    def test_annulation_par_le_client_ne_le_notifie_pas(self):
        commandes.annuler(self.commande_, self.client_a, "client", "Changement de projet")
        self.assertEqual(self.types(self.client_a), [])

    def test_etapes_travaux_terminee_annulee_vers_le_client(self):
        proposition = commandes.proposer(self.commande_, self.membre, "equipe", {"prix_m2": 12000})
        commandes.repondre(proposition, self.client_a, "client", accepter=True)
        Notification.objects.all().delete()
        commandes.changer_etat_equipe(self.commande_, "travaux", self.membre)
        commandes.changer_etat_equipe(self.commande_, "terminee", self.membre)
        self.assertEqual(self.types(self.client_a), ["etape_changee", "etape_changee"])
        etapes = [n.donnees["etape"] for n in Notification.objects.order_by("id")]
        self.assertEqual(etapes, ["travaux", "terminee"])
        self.assertEqual(self.types(self.membre), [])

    def test_texte_produit_a_la_lecture_dans_la_langue_de_la_requete(self):
        commandes.proposer(self.commande_, self.membre, "equipe", {"prix_m2": 12000})
        notification = Notification.objects.get(utilisateur=self.client_a)
        with translation.override("fr"):
            fr = services.notification_en_dict(notification)
        with translation.override("en"):
            en = services.notification_en_dict(notification)
        self.assertIn("Du nouveau", fr["titre"])
        self.assertIn("News about your order", en["titre"])
        self.assertEqual(fr["lien"], f"/commandes/{self.commande_.pk}")
        self.assertNotIn("News", notification.donnees.values())  # rien de traduit n'est figé en base

    def test_devis_envoye_notifie_une_seule_fois(self):
        devis = Devis.objects.create(commande=self.commande_, cree_par=self.membre)
        LigneDevis.objects.create(devis=devis, ordre=0, type_ligne="forfait", libelle="Forfait", montant_forfait=250000)
        devis_services.envoyer(devis, self.membre)
        self.assertEqual(self.types(self.client_a), ["devis_envoye"])  # pas de « proposition reçue » en plus
        mail = EnvoiEmail.objects.get(destinataire_email="a@exemple.cm")
        self.assertIn("250", mail.corps_texte)


class DemandesTests(BaseNotifications):
    def test_demande_de_rendu(self):
        demande = devis_services.deposer_demande(self.client_a, {
            "description": "Un rendu époxy pour mon salon de vingt mètres carrés.", "type_batiment": "maison"})
        self.assertEqual(self.types(self.membre), ["demande_rendu_nouvelle"])
        self.assertEqual(self.types(self.client_a), [])
        devis_services.mettre_a_jour_demande(demande, {"notes_internes": "à voir"})
        self.assertEqual(self.types(self.client_a), [])  # une note interne ne prévient jamais le client
        devis_services.mettre_a_jour_demande(demande, {"reponse_equipe": "Nous passerons mardi."})
        self.assertEqual(self.types(self.client_a), ["demande_rendu_repondue"])
        devis_services.mettre_a_jour_demande(demande, {"etat": "en_etude"})
        self.assertEqual(self.types(self.client_a), ["demande_rendu_repondue"] * 2)
        self.assertEqual(DemandeRendu.objects.count(), 1)

    def test_contact_et_reponse_au_client_connecte(self):
        demande = contact.creer_demande({"message": "Bonjour, une question", "type": "question"}, self.client_a)
        self.assertEqual(self.types(self.membre), ["contact_nouveau"])
        contact.mettre_a_jour(demande, {"notes_internes": "note"})
        self.assertEqual(self.types(self.client_a), [])
        contact.mettre_a_jour(demande, {"reponse_equipe": "Voici la réponse"})
        contact.mettre_a_jour(demande, {"etat": "traitee"})
        self.assertEqual(self.types(self.client_a), ["contact_repondu", "contact_repondu"])

    def test_visiteur_sans_compte_ne_recoit_rien(self):
        demande = contact.creer_demande({"nom": "Visiteur", "email": "v@exemple.cm", "message": "Bonjour à vous",
                                         "type": "question"})
        Notification.objects.all().delete()
        EnvoiEmail.objects.all().delete()
        contact.mettre_a_jour(demande, {"reponse_equipe": "Réponse", "etat": "traitee"})
        self.assertEqual((Notification.objects.count(), EnvoiEmail.objects.count()), (0, 0))


class MessagesTests(BaseNotifications):
    def setUp(self):
        super().setUp()
        self.conv = messagerie.conversation_du_client(self.client_a)

    def test_message_du_client_notifie_l_equipe_sans_email_immediat(self):
        messagerie.envoyer_message(self.conv, self.client_a, texte="Bonjour")
        self.assertEqual(self.types(self.membre), ["message_nouveau"])
        self.assertEqual(self.types(self.client_a), [])
        self.assertEqual(EnvoiEmail.objects.count(), 0)  # l'e-mail est différé (10 minutes)

    def test_les_messages_d_une_conversation_se_regroupent(self):
        for i in range(3):
            messagerie.envoyer_message(self.conv, self.client_a, texte=f"m{i}")
        notification = Notification.objects.get(utilisateur=self.membre)
        self.assertEqual(notification.donnees["nombre"], 3)
        self.assertEqual(Notification.objects.filter(utilisateur=self.membre).count(), 1)

    def test_lecture_marque_les_notifications_lues(self):
        message = messagerie.envoyer_message(self.conv, self.client_a, texte="Bonjour")[0]
        reponse = messagerie.envoyer_message(self.conv, self.membre, texte="Salut")[0]
        self.assertEqual(self.types(self.client_a), ["message_nouveau"])
        messagerie.marquer_lu(self.conv, self.client_a, reponse.pk)
        self.assertFalse(Notification.objects.filter(utilisateur=self.client_a, lue=False).exists())
        self.assertTrue(Notification.objects.filter(utilisateur=self.membre, lue=False).exists())
        messagerie.marquer_lu(self.conv, self.membre, message.pk)
        self.assertFalse(Notification.objects.filter(utilisateur=self.super_admin, lue=False).exists())  # boîte partagée

    def test_appel_manque_notifie_l_equipe(self):
        from apps.appels.models import Appel
        from apps.appels.signals import appel_manque

        appel = Appel.objects.create(client=self.client_a, type="audio", salle="cir-" + "a" * 24)
        appel_manque.send(sender=Appel, appel=appel)
        self.assertEqual(self.types(self.membre), ["appel_manque"])
        self.assertIn("Alice Client", services.notification_en_dict(Notification.objects.get(utilisateur=self.membre))["titre"])


class RobustesseTests(BaseNotifications):
    def test_une_panne_de_notification_ne_fait_pas_echouer_l_action(self):
        with mock.patch.object(services, "notifier", side_effect=RuntimeError("panne")), \
                self.assertLogs("cir.notifications", level="ERROR"):
            commande = self.commande()
        self.assertTrue(commande.pk)  # la commande est bien créée

    def test_une_panne_de_base_dans_un_abonne_laisse_la_transaction_utilisable(self):
        from django.db import IntegrityError

        def casse(*a, **k):
            Notification.objects.create(utilisateur_id=999999, type="x")  # clé étrangère invalide à la validation
            raise IntegrityError

        with mock.patch.object(services, "notifier", side_effect=IntegrityError("x")), \
                self.assertLogs("cir.notifications", level="ERROR"):
            commande = self.commande()
        self.assertTrue(commande.pk)
        self.assertTrue(type(commande).objects.filter(pk=commande.pk).exists())

    def test_envoi_immediat_apres_validation(self):
        with override_settings(NOTIFICATIONS_ENVOI_IMMEDIAT=True), \
                mock.patch.object(taches, "traiter_sans_erreur") as traiter, \
                mock.patch("django.db.transaction.on_commit", side_effect=lambda f: f()):
            self.commande()
        self.assertEqual(traiter.call_count, 3)

    def test_pas_d_envoi_immediat_si_desactive(self):
        with mock.patch.object(taches, "traiter_sans_erreur") as traiter, \
                mock.patch("django.db.transaction.on_commit", side_effect=lambda f: f()):
            self.commande()
        traiter.assert_not_called()

    def test_cle_unique_empeche_les_doublons(self):
        donnees = {"commande": 1, "reference": "CIR-2026-0001", "nom": "Alice"}
        for _ in range(2):
            services.mettre_en_file(self.client_a, "commande_creee", donnees, "commande_creee:1:1")
        self.assertEqual(EnvoiEmail.objects.count(), 1)


class NouveautesTests(BaseNotifications):
    def setUp(self):
        super().setUp()
        self.client_b.recevoir_nouveautes = True
        self.client_b.save()
        self.actualite = Actualite.objects.create(titre="Nouveau sol", resume="Un sol tout neuf",
                                                  traductions={"en": {"titre": "New floor", "resume": "A brand new floor"}})
        Actualite.objects.filter(pk=self.actualite.pk).update(notifiee_le=None)

    def test_nouveaute_annoncee_une_seule_fois(self):
        self.assertEqual(taches.notifier_actualites(), 1)
        self.assertEqual(taches.notifier_actualites(), 0)
        self.actualite.refresh_from_db()
        self.assertIsNotNone(self.actualite.notifiee_le)
        for client in (self.client_a, self.client_b):
            self.assertEqual(self.types(client), ["nouveaute"])
        self.assertEqual(self.types(self.membre), [])  # l'équipe n'est pas concernée

    def test_email_seulement_avec_consentement_et_lien_de_desabonnement(self):
        taches.notifier_actualites()
        mail = EnvoiEmail.objects.get()
        self.assertEqual(mail.destinataire_email, "b@exemple.cm")
        self.assertIn("/api/notifications/desabonnement/?jeton=", mail.corps_texte)
        self.assertTrue(mail.entetes["List-Unsubscribe"].startswith("<https://api.exemple.cm/api/notifications/"))
        self.assertEqual(mail.entetes["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
        self.assertIn("Nouveau sol", mail.corps_texte)

    def test_titre_dans_la_langue_du_destinataire(self):
        self.client_b.langue = "en"
        self.client_b.save()
        taches.notifier_actualites()
        self.assertIn("New floor", EnvoiEmail.objects.get().corps_texte)
        notification = Notification.objects.get(utilisateur=self.client_a)
        with translation.override("en"):
            self.assertEqual(services.notification_en_dict(notification)["titre"], "New floor")
        with translation.override("de"):  # pas de traduction allemande : repli sur le français
            self.assertEqual(services.notification_en_dict(notification)["titre"], "Nouveau sol")

    def test_actualite_programmee_ou_non_publiee_pas_annoncee(self):
        Actualite.objects.filter(pk=self.actualite.pk).update(publie_le=timezone.now() + timedelta(days=1))
        brouillon = Actualite.objects.create(titre="Brouillon", publie=False)
        Actualite.objects.filter(pk=brouillon.pk).update(notifiee_le=None)
        self.assertEqual(taches.notifier_actualites(), 0)
        Actualite.objects.filter(pk=self.actualite.pk).update(publie_le=timezone.now() - timedelta(minutes=1))
        self.assertEqual(taches.notifier_actualites(), 1)

    def test_sans_adresse_publique_pas_d_email_de_nouveaute(self):
        with override_settings(API_URL_PUBLIQUE=""), self.assertLogs("cir.notifications", level="WARNING"):
            taches.notifier_actualites()
        self.assertEqual(EnvoiEmail.objects.count(), 0)
        self.assertEqual(Notification.objects.filter(type="nouveaute").count(), 2)

    def test_une_panne_n_empeche_pas_de_marquer_l_actualite(self):
        with mock.patch.object(services, "diffuser_nouveaute", side_effect=RuntimeError), \
                self.assertLogs("cir.notifications", level="ERROR"):
            self.assertEqual(taches.notifier_actualites(), 1)
        self.actualite.refresh_from_db()
        self.assertIsNotNone(self.actualite.notifiee_le)

    def test_actualites_existantes_a_la_migration_sont_marquees(self):
        import importlib

        migration = importlib.import_module("apps.actualites.migrations.0002_notifiee_le")
        from django.apps import apps as registre

        migration.marquer_existantes(registre, None)
        self.actualite.refresh_from_db()
        self.assertIsNotNone(self.actualite.notifiee_le)
