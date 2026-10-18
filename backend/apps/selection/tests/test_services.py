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


class AjoutSimultaneTests(BaseVague2):
    def test_conflit_d_unicite_renvoie_l_element_existant(self):
        from unittest import mock

        from django.db import IntegrityError
        from apps.selection.models import ElementSelection

        existant = ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)

        def concurrent(**kw):  # l'autre requête a gagné la course juste avant
            raise IntegrityError("unique")

        with mock.patch.object(services.ElementSelection.objects, "filter") as filtre:
            filtre.return_value.first.return_value = None
            filtre.return_value.count.return_value = 0
            with mock.patch.object(services.ElementSelection.objects, "create", side_effect=concurrent):
                element, cree = services.ajouter(self.client_a, self.produit.pk)
        self.assertEqual((element.pk, cree), (existant.pk, False))
