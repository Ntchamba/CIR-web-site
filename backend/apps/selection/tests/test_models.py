from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.catalogue.models import Design, Famille, Produit
from apps.catalogue.tests.outils import creer_client
from apps.selection.models import ElementSelection


class ElementSelectionTests(TestCase):
    def setUp(self):
        self.client_a = creer_client()
        self.produit = Produit.objects.create(famille=Famille.objects.create(nom="F"), nom="P")
        self.design = Design.objects.create(produit=self.produit, nom="D")

    def test_unicite_avec_design(self):
        ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit, design=self.design)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit, design=self.design)

    def test_unicite_sans_design(self):
        ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)
        # avec un design, c'est un autre élément
        ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit, design=self.design)
        self.assertEqual(ElementSelection.objects.count(), 2)

    def test_suppression_du_produit_retire_l_element(self):
        ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)
        self.produit.delete()
        self.assertEqual(ElementSelection.objects.count(), 0)
