"""Modèles des contenus : enregistrement unique de l'accueil, coordonnées initiales, lien des bandeaux."""
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.contenus.models import ContenuAccueil, lien_interne


class ModelesContenusTests(TestCase):
    def test_coordonnees_initiales_par_migration(self):
        contenu = ContenuAccueil.charger()
        self.assertEqual(contenu.telephones, ["+237 6 99 81 16 35", "+237 6 78 82 93 13", "+237 6 56 43 58 46"])
        self.assertEqual(contenu.whatsapp, "+237 622 191 931")
        self.assertEqual(contenu.adresse, "Total Nkolmbong, Douala")
        self.assertEqual((contenu.titre, contenu.email), ("", ""))

    def test_enregistrement_unique(self):
        ContenuAccueil(titre="Autre").save()
        self.assertEqual(ContenuAccueil.objects.count(), 1)
        self.assertEqual(ContenuAccueil.charger().titre, "Autre")

    def test_lien_interne(self):
        lien_interne("")
        lien_interne("/catalogue?usage=maison")
        for lien in ("https://exemple.com", "//exemple.com", "catalogue", "/\\exemple.com"):
            with self.subTest(lien=lien), self.assertRaises(ValidationError):
                lien_interne(lien)
