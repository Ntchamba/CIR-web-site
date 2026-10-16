"""Règles du catalogue : prix, familles, produits, commande de données de référence."""
from io import StringIO

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError

from apps.catalogue import services
from apps.catalogue.models import Caracteristique, Famille, Produit
from apps.catalogue.prix import normaliser_prix, prix_en_texte


class PrixTests(SimpleTestCase):
    def test_normaliser(self):
        for valeur, attendu in [(None, None), ("", None), ("  ", None), (12500, 12500), ("12500", 12500),
                                ("12 500", 12500), (0, 0), (15000.0, 15000)]:
            with self.subTest(valeur=valeur):
                self.assertEqual(normaliser_prix(valeur), attendu)

    def test_refus(self):
        for valeur in (-1, "-5", "12,5", "abc", 12.5, True, 10**10, [1]):
            with self.subTest(valeur=valeur), self.assertRaises(ValidationError):
                normaliser_prix(valeur)

    def test_texte(self):
        self.assertEqual(prix_en_texte(12500), "12500")
        self.assertIsNone(prix_en_texte(None))


class ServicesCatalogueTests(TestCase):
    def setUp(self):
        self.famille = services.enregistrer_famille(None, {"nom": "  Finitions  "})

    def test_famille_nom_unique_insensible_a_la_casse(self):
        self.assertEqual(self.famille.nom, "Finitions")
        with self.assertRaises(ValidationError):
            services.enregistrer_famille(None, {"nom": "finitions"})

    def test_suppression_famille_avec_produits_refusee(self):
        services.enregistrer_produit(None, {"famille": self.famille, "nom": "X"})
        with self.assertRaises(ValidationError):
            services.supprimer_famille(self.famille)
        vide = services.enregistrer_famille(None, {"nom": "Vide"})
        services.supprimer_famille(vide)
        self.assertFalse(Famille.objects.filter(nom="Vide").exists())

    def test_lignes_remplacees_en_entier_dans_l_ordre(self):
        p = services.enregistrer_produit(None, {
            "famille": self.famille, "nom": "X", "reference": " yd-500 ",
            "caracteristiques": [{"libelle": "Séchage", "valeur": "24 h"}, {"libelle": "Adhérence", "valeur": "≥ 2 MPa"}],
        })
        self.assertEqual(p.reference, "YD-500")
        self.assertEqual(list(p.caracteristiques.values_list("libelle", "ordre")), [("Séchage", 0), ("Adhérence", 1)])
        services.enregistrer_produit(p, {"caracteristiques": [{"libelle": "Dureté", "valeur": "H"}]})
        self.assertEqual(list(Caracteristique.objects.values_list("libelle", flat=True)), ["Dureté"])
        services.enregistrer_produit(p, {"nom": "Y"})  # non fournies : conservées
        self.assertEqual(p.caracteristiques.count(), 1)

    def test_reference_en_double(self):
        services.enregistrer_produit(None, {"famille": self.famille, "nom": "X", "reference": "YD-1"})
        with self.assertRaises(ValidationError):
            services.enregistrer_produit(None, {"famille": self.famille, "nom": "Y", "reference": "yd-1"})


class CommandeReferenceTests(TestCase):
    def test_idempotente_et_sans_prix(self):
        call_command("charger_catalogue_reference", stdout=StringIO())
        call_command("charger_catalogue_reference", stdout=StringIO())
        self.assertEqual(Famille.objects.count(), 9)
        self.assertEqual(Produit.objects.count(), 9)
        self.assertFalse(Produit.objects.filter(prix__isnull=False).exists())
        self.assertTrue(all(p.en_ligne for p in Produit.objects.all()))
        self.assertEqual(set(Produit.objects.filter(a_la_une=True).values_list("reference", flat=True)),
                         {"YD-500", "YD-306", "YD-518"})
        for famille in Famille.objects.all():
            self.assertEqual(famille.langues_incompletes(), [], famille.nom)
        for produit in Produit.objects.all():
            self.assertEqual(produit.langues_incompletes(), [], produit.reference)

    def test_ne_modifie_pas_les_donnees_de_l_equipe(self):
        call_command("charger_catalogue_reference", stdout=StringIO())
        Produit.objects.filter(reference="YD-500").update(nom="Nom choisi", prix=9000)
        call_command("charger_catalogue_reference", stdout=StringIO())
        p = Produit.objects.get(reference="YD-500")
        self.assertEqual((p.nom, p.prix), ("Nom choisi", 9000))
