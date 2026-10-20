"""Adoption de la référence CamPay d'un paiement par lien (webhook signé), sans jamais croire le webhook."""
import os
from unittest import mock

import jwt
from django.db import IntegrityError, transaction

from apps.commandes.models import Commande
from apps.paiements import services
from apps.paiements.models import Paiement

from .outils import URL, BasePaiements


class AdoptionTests(BasePaiements):
    CLE = "cle-de-test-webhook-assez-longue-123456"
    CANDIDATE = "ref-campay-lien-0001"

    def setUp(self):
        super().setUp()
        env = mock.patch.dict(os.environ, {"CAMPAY_WEBHOOK_KEY": self.CLE})
        env.start()
        self.addCleanup(env.stop)
        self.client.force_authenticate(None)

    def lien(self, commande=None, **champs):
        return self.paiement_en_base(commande=commande, mode="lien", reference_campay="", **champs)

    def webhook(self, p, reference=None):
        return self.client.post(URL + "webhooks/campay/", {
            "reference": reference or self.CANDIDATE, "external_reference": p.reference_externe,
            "status": "SUCCESSFUL", "signature": jwt.encode({"x": 1}, self.CLE, algorithm="HS256")}, format="json")

    def paye(self):
        return Commande.objects.get(pk=self.commande.pk).montant_paye

    def test_lien_encaisse_via_webhook_signe(self):
        p = self.lien()
        self.annoncer(p)
        self.assertEqual(self.webhook(p).status_code, 200)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.reference_campay, self.paye()), ("reussi", self.CANDIDATE, 100_000))
        self.webhook(p)
        self.assertEqual(self.paye(), 100_000)

    def test_autre_reference_externe_rien_adopte_rien_encaisse(self):
        p = self.lien()
        self.annoncer(p, reference_externe="cir-autre-paiement-000000")
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.reference_campay, self.paye()), ("en_attente", "", 0))

    def test_transaction_sans_reference_externe_rien_adopte(self):
        p = self.lien()
        self.annoncer(p, reference_externe="")
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.reference_campay, self.paye()), ("en_attente", "", 0))

    def test_reference_deja_utilisee_par_un_autre_paiement_refusee(self):
        autre = self.creer_commande_payable(self.client_b)
        self.paiement_en_base(commande=autre, reference_campay=self.CANDIDATE)
        p = self.lien()
        self.annoncer(p)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.reference_campay, self.paye()), ("", 0))
        self.campay.statut.assert_not_called()

    def test_reference_invalide_refusee(self):
        p = self.lien()
        self.annoncer(p)
        self.webhook(p, reference="a b")
        p.refresh_from_db()
        self.assertEqual(p.reference_campay, "")

    def test_jamais_une_seconde_reference(self):
        p = self.lien()
        self.annoncer(p, "en_attente")
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual(p.reference_campay, self.CANDIDATE)
        self.webhook(p, reference="ref-campay-lien-0002")
        p.refresh_from_db()
        self.assertEqual(p.reference_campay, self.CANDIDATE)

    def test_deux_webhooks_une_seule_adoption_un_seul_encaissement(self):
        p = self.lien()
        self.annoncer(p)
        paiement = Paiement.objects.get(pk=p.pk)
        # Simule la course : les deux webhooks ont interrogé CamPay avant que l'un ait adopté la référence
        self.assertTrue(services._adopter_reference(paiement, self.CANDIDATE))
        self.assertFalse(services._adopter_reference(paiement, "ref-campay-lien-0002"))  # instance périmée
        services.verifier(Paiement.objects.get(pk=p.pk))
        services.verifier(Paiement.objects.get(pk=p.pk))
        p.refresh_from_db()
        self.assertEqual((p.reference_campay, p.etat, self.paye()), (self.CANDIDATE, "reussi", 100_000))

    def test_contrainte_d_unicite(self):
        autre = self.creer_commande_payable(self.client_b)
        self.paiement_en_base(commande=autre, reference_campay=self.CANDIDATE)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.paiement_en_base(reference_campay=self.CANDIDATE)
        self.lien()  # plusieurs paiements sans référence restent permis
        self.lien(etat="echoue")

    def test_montant_different_apres_adoption_donne_une_anomalie(self):
        p = self.lien()
        self.annoncer(p, montant=1)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, self.paye()), ("anomalie", 0))


class AdoptionComplementsTests(AdoptionTests):
    """Compléments du testeur : états annulé/expiré, mode mobile, journaux."""

    def test_annule_puis_confirme_donne_une_anomalie_sans_encaissement(self):
        p = self.lien(etat="annule")
        self.annoncer(p)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, self.paye()), ("anomalie", 0))

    def test_expire_puis_confirme_encaisse_une_fois(self):
        p = self.lien(etat="expire")
        self.annoncer(p)
        self.webhook(p)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.etat, self.paye()), ("reussi", 100_000))

    def test_mode_mobile_sans_reference_n_adopte_rien(self):
        p = self.paiement_en_base(reference_campay="")
        self.annoncer(p)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.reference_campay, p.etat, self.paye()), ("", "en_attente", 0))

    def test_paiement_final_n_adopte_rien(self):
        p = self.lien(etat="echoue")
        self.annoncer(p)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.reference_campay, p.etat, self.paye()), ("", "echoue", 0))

    def test_journaux_sans_numero_ni_signature(self):
        p = self.lien()
        self.annoncer(p, reference_externe="cir-autre-paiement-000000")
        with self.assertLogs("cir.paiements", level="WARNING") as j:
            self.webhook(p)
        texte = "\n".join(j.output)
        for secret in ("699001122", self.CLE, self.CANDIDATE):
            self.assertNotIn(secret, texte)
