from rest_framework.exceptions import ValidationError

from apps.commandes.tests.outils import BaseVague2
from apps.selection import services


class SelectionServicesTests(BaseVague2):
    def test_ajouter_renvoie_cree_ou_existant(self):
        element, cree = services.ajouter(self.client_a, self.produit.pk, self.design.pk)
        self.assertTrue(cree)
        meme, cree = services.ajouter(self.client_a, self.produit.pk, self.design.pk)
        self.assertFalse(cree)
        self.assertEqual(element.pk, meme.pk)

    def test_ajouter_refus(self):
        for produit, design in [(self.hors_ligne.pk, None), (0, None), (self.produit.pk, 0)]:
            with self.subTest(produit=produit, design=design), self.assertRaises(ValidationError):
                services.ajouter(self.client_a, produit, design)

    def test_resume_sans_doublon_et_vider(self):
        services.ajouter(self.client_a, self.produit.pk)
        services.ajouter(self.client_a, self.produit.pk, self.design.pk)
        services.ajouter(self.client_b, self.autre_produit.pk)
        self.assertEqual(services.ids_produits(self.client_a), [self.produit.pk])
        services.vider(self.client_a)
        self.assertEqual(services.ids_produits(self.client_a), [])
        self.assertEqual(services.ids_produits(self.client_b), [self.autre_produit.pk])
