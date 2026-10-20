"""Compléments du testeur : idempotence par webhooks répétés, journaux sans numéro, paiement par lien."""
import os
from unittest import mock

import jwt

from apps.commandes.models import Commande
from apps.paiements import services
from apps.paiements.models import Paiement
from integrations.campay.erreurs import CampayErreurDefinitive, CampayErreurTemporaire

from .outils import URL, BasePaiements, transaction_campay


class ComplementsTests(BasePaiements):
    CLE = "cle-de-test-webhook-assez-longue-123456"

    def setUp(self):
        super().setUp()
        env = mock.patch.dict(os.environ, {"CAMPAY_WEBHOOK_KEY": self.CLE})
        env.start()
        self.addCleanup(env.stop)

    def webhook(self, p, reference="ref-campay-0001"):
        return self.client.post(URL + "webhooks/campay/", {
            "reference": reference, "external_reference": p.reference_externe, "status": "SUCCESSFUL",
            "signature": jwt.encode({"x": 1}, self.CLE, algorithm="HS256")}, format="json")

    def paye(self):
        return Commande.objects.get(pk=self.commande.pk).montant_paye

    def test_deux_webhooks_et_une_verification_une_seule_ecriture(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        self.webhook(p)
        self.webhook(p)
        services.verifier(p)
        self.se_connecter(self.client_a)
        self.client.get(f"{URL}{p.pk}/")
        self.assertEqual(self.paye(), 100_000)

    def test_aucun_numero_complet_dans_les_journaux_ni_les_reponses(self):
        with self.assertLogs("cir", level="DEBUG") as journaux:
            import logging
            logging.getLogger("cir.paiements").warning("sonde")
            self.campay.initier_collecte.side_effect = CampayErreurTemporaire("réseau")
            r1 = self.initier()
            self.campay.initier_collecte.side_effect = CampayErreurDefinitive("refus", code="numero_invalide") \
                if "code" in CampayErreurDefinitive.__init__.__code__.co_varnames else CampayErreurTemporaire("x")
            r2 = self.initier()
        texte = "\n".join(journaux.output) + str(r1.content) + str(r2.content)
        for numero in ("699001122", "237699001122", "6 99 00 11 22"):
            self.assertNotIn(numero, texte)

    def test_paiement_par_lien_peut_etre_encaisse(self):
        """Un paiement par lien n'a pas de reference_campay à l'initiation : le webhook doit permettre de l'encaisser."""
        r = self.initier(mode="lien")
        self.assertEqual(r.status_code, 201, r.content)
        p = Paiement.objects.get(pk=r.data["id"])
        self.annoncer(p)
        self.webhook(p, reference="ref-campay-lien-0001")
        p.refresh_from_db()
        self.assertEqual((p.etat, self.paye()), ("reussi", p.montant))
