"""Modèles du catalogue : slugs, usages, traductions, images WebP."""
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.catalogue.models import Famille, ImageProduit, Produit

from .outils import MediasTemporairesMixin, image_png


class ModelesCatalogueTests(MediasTemporairesMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.famille = Famille.objects.create(nom="Finitions")

    def test_slugs_automatiques_et_uniques(self):
        self.assertEqual(self.famille.slug, "finitions")
        p1 = Produit.objects.create(famille=self.famille, nom="Sol autolissant", reference="YD-500")
        p2 = Produit.objects.create(famille=self.famille, nom="Sol autolissant")
        p3 = Produit.objects.create(famille=self.famille, nom="Sol autolissant")
        self.assertEqual(p1.slug, "sol-autolissant-yd-500")
        self.assertEqual(p2.slug, "sol-autolissant")
        self.assertEqual(p3.slug, "sol-autolissant-2")
        p1.nom = "Autre nom"
        p1.save()
        self.assertEqual(p1.slug, "sol-autolissant-yd-500")  # adresse stable

    def test_reference_unique_si_renseignee(self):
        Produit.objects.create(famille=self.famille, nom="A")
        Produit.objects.create(famille=self.famille, nom="B")  # deux références vides : permis
        Produit.objects.create(famille=self.famille, nom="C", reference="YD-1")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Produit.objects.create(famille=self.famille, nom="D", reference="YD-1")

    def test_usages_et_prix_par_defaut(self):
        p = Produit.objects.create(famille=self.famille, nom="X", pour_maison=True, pour_exterieur=True)
        self.assertEqual(p.usages, ["maison", "exterieur"])
        self.assertIsNone(p.prix)
        self.assertTrue(p.en_ligne)
        self.assertEqual(p.unite_prix, "m2")

    def test_traduction_du_nom(self):
        p = Produit.objects.create(famille=self.famille, nom="Sol autolissant",
                                   traductions={"en": {"nom": "Self-levelling floor"}})
        self.assertEqual(p.traduit("nom", "en"), "Self-levelling floor")
        self.assertEqual(p.traduit("nom", "ja"), "Sol autolissant")
        self.assertIn("ja", p.langues_incompletes())

    def test_image_convertie_en_webp(self):
        p = Produit.objects.create(famille=self.famille, nom="X")
        image = ImageProduit.objects.create(produit=p, image=image_png(largeur=2000, hauteur=1000))
        self.assertTrue(image.image.name.endswith(".webp"))
        self.assertEqual(image.image.width, 1280)
