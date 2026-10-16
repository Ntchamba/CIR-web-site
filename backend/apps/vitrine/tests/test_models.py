"""Modèles de la vitrine."""
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.vitrine.models import Realisation, StatutTemoignage, Temoignage
from apps.catalogue.tests.outils import MediasTemporairesMixin, image_png


class ModelesVitrineTests(MediasTemporairesMixin, TestCase):
    def test_realisation_slug_et_webp(self):
        r = Realisation.objects.create(titre="Salon à Bonapriso", type_chantier="maison", image_apres=image_png())
        self.assertEqual(r.slug, "salon-a-bonapriso")
        self.assertTrue(r.image_apres.name.endswith(".webp"))
        self.assertTrue(r.publie)

    def test_temoignage_par_defaut_en_attente_et_note_contrainte(self):
        t = Temoignage.objects.create(nom_affiche="A", texte="x" * 30, note=5)
        self.assertEqual(t.statut, StatutTemoignage.EN_ATTENTE)
        self.assertEqual(t.langue, "fr")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Temoignage.objects.create(nom_affiche="A", texte="x" * 30, note=6)
