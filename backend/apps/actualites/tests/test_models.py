"""Modèle des actualités."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.actualites.models import Actualite


class ModeleActualiteTests(TestCase):
    def test_slug_et_programmation(self):
        a = Actualite.objects.create(titre="Nouvelle gamme")
        self.assertEqual(a.slug, "nouvelle-gamme")
        self.assertFalse(a.programmee)
        b = Actualite.objects.create(titre="Nouvelle gamme", publie_le=timezone.now() + timedelta(days=2))
        self.assertEqual(b.slug, "nouvelle-gamme-2")
        self.assertTrue(b.programmee)
