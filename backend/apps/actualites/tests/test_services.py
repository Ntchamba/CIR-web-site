"""Règles des actualités : visibilité publique et enregistrement."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.actualites import services
from apps.actualites.models import Actualite


class ServicesActualitesTests(TestCase):
    def test_actualites_publiques(self):
        maintenant = timezone.now()
        ancienne = Actualite.objects.create(titre="Ancienne", publie_le=maintenant - timedelta(days=3))
        recente = Actualite.objects.create(titre="Récente", publie_le=maintenant - timedelta(hours=1))
        Actualite.objects.create(titre="Programmée", publie_le=maintenant + timedelta(days=1))
        Actualite.objects.create(titre="Brouillon", publie=False)
        self.assertEqual(list(services.actualites_publiques()), [recente, ancienne])

    def test_titre_obligatoire(self):
        with self.assertRaises(ValidationError):
            services.enregistrer_actualite(None, {"titre": "   "})
        a = services.enregistrer_actualite(None, {"titre": " Nouveauté ", "publie_le": None})
        self.assertEqual(a.titre, "Nouveauté")
        self.assertIsNotNone(a.publie_le)
