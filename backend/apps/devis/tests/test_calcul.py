"""Calcul des devis : trois types de ligne, arrondis demi vers le haut, manques signalés."""
from decimal import Decimal

from django.test import SimpleTestCase

from apps.devis import calcul


class CalculTests(SimpleTestCase):
    def test_arrondi_demi_vers_le_haut(self):
        self.assertEqual(calcul.arrondir(Decimal("2.5")), Decimal("3"))
        self.assertEqual(calcul.arrondir(Decimal("12.345"), 2), Decimal("12.35"))
        self.assertEqual(calcul.arrondir(Decimal("0.4999")), Decimal("0"))

    def test_materiau(self):
        r = calcul.calculer_ligne({"type_ligne": "materiau", "surface_m2": Decimal("42.5"),
                                   "dosage_kg_m2": Decimal("0.35"), "prix_kg": 4500})
        self.assertEqual(r.quantite_kg, Decimal("14.88"))  # 14,875 -> 14,88
        self.assertEqual(r.montant, 66960)
        self.assertEqual(r.erreurs, [])

    def test_surface_et_forfait(self):
        r = calcul.calculer_ligne({"type_ligne": "surface", "surface_m2": Decimal("10.5"), "prix_m2": 1001})
        self.assertEqual(r.montant, 10511)  # 10510,5 -> 10511
        r = calcul.calculer_ligne({"type_ligne": "forfait", "montant_forfait": 25000})
        self.assertEqual(r.montant, 25000)

    def test_manques(self):
        r = calcul.calculer_ligne({"type_ligne": "materiau", "surface_m2": Decimal("10")})
        self.assertIsNone(r.montant)
        self.assertEqual({c for c, _m in r.erreurs}, {"dosage_kg_m2", "prix_kg"})
        r = calcul.calculer_ligne({"type_ligne": "surface", "surface_m2": Decimal("0"), "prix_m2": 10})
        self.assertEqual([c for c, _m in r.erreurs], ["surface_m2"])
        self.assertEqual(calcul.calculer_ligne({"type_ligne": "x"}).erreurs[0][0], "type_ligne")

    def test_total_complet_et_erreurs(self):
        r = calcul.calculer([{"type_ligne": "forfait", "montant_forfait": 1000},
                             {"type_ligne": "surface", "surface_m2": Decimal("2")}])
        self.assertEqual((r.total, r.complet), (1000, False))
        self.assertEqual(r.erreurs[0]["ligne"], 1)
        self.assertFalse(calcul.calculer([]).complet)
        self.assertTrue(calcul.calculer([{"type_ligne": "forfait", "montant_forfait": 0}]).complet)
