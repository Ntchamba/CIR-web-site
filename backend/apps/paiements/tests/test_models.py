"""Modèle Paiement : références, contraintes."""
import re

from django.db import IntegrityError, transaction

from apps.paiements.models import EtatPaiement, Paiement

from .outils import BasePaiements


class ModeleTests(BasePaiements):
    def test_references(self):
        p = self.paiement_en_base()
        self.assertRegex(p.reference, r"^PAY-\d{4}-0001$")
        self.assertRegex(p.reference_externe, r"^cir-[0-9a-f]{24}$")
        self.assertTrue(re.match(r"^[A-Za-z0-9_-]{8,64}$", p.reference_externe))
        self.assertEqual(p.devise, "XAF")
        q = self.paiement_en_base(etat=EtatPaiement.ECHOUE)
        self.assertNotEqual(p.reference_externe, q.reference_externe)
        self.assertRegex(q.reference, r"^PAY-\d{4}-0002$")

    def test_un_seul_paiement_en_attente_par_commande(self):
        self.paiement_en_base()
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.paiement_en_base()
        self.paiement_en_base(etat=EtatPaiement.EXPIRE)  # les autres états se cumulent
        self.assertEqual(Paiement.objects.count(), 2)

    def test_montant_positif(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.paiement_en_base(montant=0)
