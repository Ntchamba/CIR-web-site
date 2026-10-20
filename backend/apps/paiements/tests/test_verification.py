"""Revérification auprès de CamPay, idempotence, webhook, annulation, reçu."""
import os
from datetime import timedelta
from unittest import mock

import jwt
from django.core.management import call_command
from django.utils import timezone

from apps.commandes.models import Commande
from apps.paiements import services, transactions
from apps.paiements.models import EtatPaiement, Paiement
from apps.paiements.signals import paiement_anomalie, paiement_echoue, paiement_reussi
from integrations.campay.erreurs import CampayErreurDefinitive, CampayErreurTemporaire

from .outils import URL, BasePaiements, transaction_campay


class EcouteSignauxMixin:
    def setUp(self):
        super().setUp()
        self.recus = []
        for nom, signal in (("reussi", paiement_reussi), ("echoue", paiement_echoue), ("anomalie", paiement_anomalie)):
            def ecouteur(sender, paiement, nom=nom, **kw):
                self.recus.append((nom, paiement.pk, paiement.commande.montant_paye))
            signal.connect(ecouteur, weak=False, dispatch_uid=f"test-{nom}-{id(self)}")
            self.addCleanup(signal.disconnect, dispatch_uid=f"test-{nom}-{id(self)}")


class VerifierTests(EcouteSignauxMixin, BasePaiements):
    def montant_paye(self):
        return Commande.objects.get(pk=self.commande.pk).montant_paye

    def test_reussi_encaisse_une_seule_fois(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        for _i in range(3):  # deux webhooks et une vérification du navigateur
            services.verifier(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.reference_operateur, p.raison), ("reussi", "OP-123456", ""))
        self.assertIsNotNone(p.termine_le)
        self.assertEqual(self.montant_paye(), 100_000)
        self.assertEqual(self.recus, [("reussi", p.pk, 100_000)])
        self.assertEqual(self.campay.statut.call_count, 1)  # un paiement final n'est plus interrogé

    def test_idempotence_apres_application_directe(self):
        p = self.paiement_en_base()
        resultat = transaction_campay(p)
        services._appliquer(p.pk, resultat)
        services._appliquer(p.pk, resultat)
        self.assertEqual(self.montant_paye(), 100_000)
        self.assertEqual(len(self.recus), 1)

    def test_statut_paiement_de_la_commande(self):
        from apps.commandes.reglement import statut_paiement
        p = self.paiement_en_base(montant=500_000)
        self.annoncer(p)
        services.verifier(p)
        self.commande.refresh_from_db()
        self.assertEqual((statut_paiement(self.commande), self.commande.montant_paye), ("paye", 500_000))

    def test_en_attente_reste_en_attente(self):
        p = self.paiement_en_base()
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "en_attente")
        self.assertIsNotNone(p.derniere_verification_le)
        self.assertEqual(self.montant_paye(), 0)

    def test_anomalies_rien_encaisse(self):
        cas = {"montant": {"montant": 99_999}, "devise": {"devise": "EUR"}, "reference": {"reference_externe": "cir-autre"}}
        for nom, changements in cas.items():
            with self.subTest(nom):
                Paiement.objects.all().delete()
                p = self.paiement_en_base()
                self.annoncer(p, **changements)
                services.verifier(p)
                p.refresh_from_db()
                self.assertEqual((p.etat, p.raison), ("anomalie", "montant_different"))
                self.assertEqual(self.montant_paye(), 0)
        self.assertEqual([r[0] for r in self.recus], ["anomalie"] * len(cas))

    def test_reference_externe_absente_de_la_reponse_n_est_pas_une_anomalie(self):
        # La transaction est lue par la référence CamPay du paiement : sans référence externe renvoyée, on encaisse.
        p = self.paiement_en_base()
        self.annoncer(p, reference_externe="")
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "reussi")
        self.assertEqual(self.montant_paye(), p.montant)

    def test_echoue(self):
        p = self.paiement_en_base()
        self.annoncer(p, "echoue", raison="texte libre de l'opérateur")
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.raison), ("echoue", "refuse"))
        self.assertEqual(self.montant_paye(), 0)
        self.assertEqual([r[0] for r in self.recus], ["echoue"])

    def test_final_jamais_modifie(self):
        p = self.paiement_en_base()
        self.annoncer(p, "echoue")
        services.verifier(p)
        self.annoncer(p, "reussi")
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "echoue")
        self.assertEqual(self.montant_paye(), 0)

    def test_expiration(self):
        p = self.paiement_en_base()
        Paiement.objects.filter(pk=p.pk).update(cree_le=timezone.now() - timedelta(minutes=16))
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.raison), ("expire", "expire"))
        self.assertEqual([r[0] for r in self.recus], ["echoue"])

    def test_pas_d_expiration_si_recent(self):
        p = self.paiement_en_base()
        Paiement.objects.filter(pk=p.pk).update(cree_le=timezone.now() - timedelta(minutes=10))
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "en_attente")

    def test_expire_puis_reussi_encaisse_une_fois(self):
        p = self.paiement_en_base(etat=EtatPaiement.EXPIRE, raison="expire")
        Paiement.objects.filter(pk=p.pk).update(reference_campay="ref-campay-0001")
        self.annoncer(p)
        services.verifier(p)
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.raison), ("reussi", ""))
        self.assertEqual(self.montant_paye(), 100_000)

    def test_expire_reste_expire_si_toujours_en_attente(self):
        p = self.paiement_en_base(etat=EtatPaiement.EXPIRE, reference_campay="ref-campay-0001")
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "expire")

    def test_depassement_du_reste_a_payer(self):
        a = self.paiement_en_base(etat=EtatPaiement.EXPIRE, montant=400_000, reference_campay="ref-a")
        b = self.paiement_en_base(montant=400_000)
        self.annoncer(b)
        self.annoncer(a)
        services.verifier(b)
        services.verifier(a)  # 400 000 + 400 000 > 500 000
        a.refresh_from_db()
        self.assertEqual((a.etat, a.raison), ("anomalie", "montant_different"))
        self.assertEqual(self.montant_paye(), 400_000)
        self.assertEqual([r[0] for r in self.recus], ["reussi", "anomalie"])

    def test_panne_camp_ay_ne_change_rien(self):
        p = self.paiement_en_base()
        for erreur in (CampayErreurTemporaire("x"), CampayErreurDefinitive("y", "inconnue")):
            self.campay.statut.side_effect = erreur
            self.assertEqual(services.verifier(p).etat, "en_attente")
        self.assertEqual(self.montant_paye(), 0)

    def test_sans_reference_campay_expire_localement(self):
        p = self.paiement_en_base(reference_campay="")
        services.verifier(p)
        self.campay.statut.assert_not_called()
        Paiement.objects.filter(pk=p.pk).update(cree_le=timezone.now() - timedelta(hours=1))
        services.verifier(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "expire")

    def test_delai_minimal_entre_deux_appels(self):
        p = self.paiement_en_base()
        services.verifier(p, delai_min=3)
        services.verifier(p, delai_min=3)
        self.assertEqual(self.campay.statut.call_count, 1)
        Paiement.objects.filter(pk=p.pk).update(derniere_verification_le=timezone.now() - timedelta(seconds=4))
        services.verifier(p, delai_min=3)
        self.assertEqual(self.campay.statut.call_count, 2)

    def test_lecture_du_client_reverifie(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        self.se_connecter(self.client_a)
        r = self.client.get(f"{URL}{p.pk}/")
        self.assertEqual((r.data["etat"], self.montant_paye()), ("reussi", 100_000))

    def test_lecture_du_client_limitee_a_une_verification_par_3_secondes(self):
        p = self.paiement_en_base()
        self.se_connecter(self.client_a)
        self.client.get(f"{URL}{p.pk}/")
        self.client.get(f"{URL}{p.pk}/")
        self.assertEqual(self.campay.statut.call_count, 1)

    def test_navigateur_qui_annonce_reussi_n_encaisse_rien(self):
        p = self.paiement_en_base()
        self.se_connecter(self.client_a)
        r = self.client.get(f"{URL}{p.pk}/?etat=reussi&status=SUCCESSFUL")
        self.assertEqual(r.data["etat"], "en_attente")
        self.assertEqual(self.montant_paye(), 0)

    def test_diffusion_en_direct_a_la_reussite(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        self.vider_publications()
        services.verifier(p)
        etats = [d["paiement"]["etat"] for _g, _t, d in self.trames(type="paiement_mis_a_jour")]
        self.assertEqual(etats, ["reussi", "reussi"])  # client et équipe


class WebhookTests(EcouteSignauxMixin, BasePaiements):
    URL = URL + "webhooks/campay/"
    CLE = "cle-de-test-webhook-assez-longue-123456"

    def setUp(self):
        super().setUp()
        env = mock.patch.dict(os.environ, {"CAMPAY_WEBHOOK_KEY": self.CLE})
        env.start()
        self.addCleanup(env.stop)

    def signature(self, cle=None):
        return jwt.encode({"x": 1}, cle or self.CLE, algorithm="HS256")

    def appeler(self, p, signature="valide", methode="post", **plus):
        donnees = {"reference": "ref-campay-0001", "external_reference": p.reference_externe, "status": "SUCCESSFUL",
                   **plus}
        if signature == "valide":
            donnees["signature"] = self.signature()
        elif signature:
            donnees["signature"] = signature
        if methode == "get":
            return self.client.get(self.URL, donnees)
        return self.client.post(self.URL, donnees, format="json")

    def test_webhook_valide_revérifie_et_encaisse(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        r = self.appeler(p)
        self.assertEqual((r.status_code, r.data), (200, {"ok": True}))
        p.refresh_from_db()
        self.assertEqual(p.etat, "reussi")
        self.assertEqual(Commande.objects.get(pk=self.commande.pk).montant_paye, 100_000)
        self.appeler(p, methode="get")  # le même webhook en GET : rien de plus
        self.assertEqual(Commande.objects.get(pk=self.commande.pk).montant_paye, 100_000)

    def test_webhook_mensonger_n_encaisse_rien(self):
        p = self.paiement_en_base()  # CamPay répond « en attente » alors que le webhook annonce un succès
        r = self.appeler(p, status="SUCCESSFUL", amount="100000")
        self.assertEqual(r.status_code, 200)
        self.campay.statut.assert_called()
        p.refresh_from_db()
        self.assertEqual(p.etat, "en_attente")
        self.assertEqual(Commande.objects.get(pk=self.commande.pk).montant_paye, 0)

    def test_signature_absente_ou_fausse(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        for signature in (None, "n-importe-quoi", self.signature("autre-cle-de-signature-0000000000")):
            with self.subTest(signature=signature):
                r = self.appeler(p, signature=signature)
                self.assertEqual(r.status_code, 403)
        self.campay.statut.assert_not_called()
        p.refresh_from_db()
        self.assertEqual(p.etat, "en_attente")

    def test_cle_non_configuree(self):
        p = self.paiement_en_base()
        with mock.patch.dict(os.environ, {"CAMPAY_WEBHOOK_KEY": ""}):
            r = self.appeler(p)
        self.assertEqual((r.status_code, r.data["code"]), (503, "webhook_non_configure"))

    def test_paiement_inconnu_repond_200(self):
        r = self.client.post(self.URL, {"reference": "x" * 12, "external_reference": "cir-inconnu0000",
                                        "signature": self.signature()}, format="json")
        self.assertEqual((r.status_code, r.data), (200, {"ok": True}))
        self.campay.statut.assert_not_called()

    def test_corps_invalide(self):
        r = self.client.post(self.URL, "{pas du json", content_type="application/json",
                             QUERY_STRING=f"signature={self.signature()}")
        self.assertEqual(r.status_code, 200)
        r = self.client.post(self.URL, "{pas du json", content_type="application/json")
        self.assertEqual(r.status_code, 403)

    def test_retrouve_par_reference_campay(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        r = self.client.post(self.URL, {"reference": "ref-campay-0001", "signature": self.signature()}, format="json")
        self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.etat, "reussi")

    def test_aucune_authentification_exigee(self):
        self.client.force_authenticate(None)
        p = self.paiement_en_base()
        self.assertEqual(self.appeler(p).status_code, 200)

    def test_webhook_sur_paiement_annule_paye_donne_une_anomalie(self):
        p = self.paiement_en_base(etat=EtatPaiement.ANNULE, mode="lien")
        Paiement.objects.filter(pk=p.pk).update(reference_campay="ref-campay-0001")
        self.annoncer(p)
        self.appeler(p)
        p.refresh_from_db()
        self.assertEqual(p.etat, "anomalie")
        self.assertEqual(Commande.objects.get(pk=self.commande.pk).montant_paye, 0)


class AnnulationEtRecuTests(BasePaiements):
    def test_annuler_lien(self):
        p = self.paiement_en_base(mode="lien")
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{p.pk}/annuler/")
        self.assertEqual((r.status_code, r.data["etat"], r.data["peut_annuler"]), (200, "annule", False))
        self.assertEqual(self.client.post(f"{URL}{p.pk}/annuler/").status_code, 409)

    def test_mobile_ne_s_annule_pas(self):
        p = self.paiement_en_base()
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{p.pk}/annuler/")
        self.assertEqual((r.status_code, r.data["code"]), (409, "paiement_non_autorise"))

    def test_annuler_un_paiement_deja_paye(self):
        p = self.paiement_en_base(mode="lien")
        self.annoncer(p)
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{p.pk}/annuler/")
        self.assertEqual(r.status_code, 409)
        p.refresh_from_db()
        self.assertEqual(p.etat, "reussi")

    def test_recu(self):
        p = self.paiement_en_base(etat=EtatPaiement.REUSSI, montant=200_000)
        Commande.objects.filter(pk=self.commande.pk).update(montant_paye=200_000)
        self.se_connecter(self.client_a)
        r = self.client.get(f"{URL}{p.pk}/recu/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data), {"paiement", "commande", "client", "emetteur", "montant_paye_total",
                                       "reste_a_payer"})
        self.assertEqual((r.data["montant_paye_total"], r.data["reste_a_payer"]), (200_000, 300_000))
        self.assertEqual(r.data["client"], {"nom_complet": "Alice Client"})
        self.assertEqual(r.data["emetteur"], {"nom": "Complexe Industriel Révélation SARL", "ville": "Douala"})
        autre = self.paiement_en_base(etat=EtatPaiement.ECHOUE)
        self.assertEqual(self.client.get(f"{URL}{autre.pk}/recu/").status_code, 404)


class CommandeReverifierTests(BasePaiements):
    def test_commande_de_gestion(self):
        a = self.paiement_en_base()
        self.annoncer(a)
        call_command("reverifier_paiements")
        a.refresh_from_db()
        self.assertEqual(a.etat, "reussi")

    def test_une_panne_ne_fait_pas_echouer(self):
        self.paiement_en_base()
        self.campay.statut.side_effect = RuntimeError("panne inattendue")
        self.assertEqual(services.reverifier_en_attente(), 0)
        call_command("reverifier_paiements")

    def test_au_plus_un_appel_toutes_les_5_secondes(self):
        self.paiement_en_base()
        services.reverifier_en_attente()
        services.reverifier_en_attente()
        self.assertEqual(self.campay.statut.call_count, 1)

    def test_dans_la_boucle_du_worker(self):
        from apps.notifications.management.commands import envoyer_emails
        a = self.paiement_en_base()
        self.annoncer(a)
        envoyer_emails.une_passe()
        a.refresh_from_db()
        self.assertEqual(a.etat, "reussi")

    def test_non_configure_n_appelle_rien(self):
        self.campay.configure.return_value = False
        self.paiement_en_base()
        services.reverifier_en_attente()
        self.assertEqual(transactions.configure(), False)
