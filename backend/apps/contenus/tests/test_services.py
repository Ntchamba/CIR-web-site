"""Règles des contenus : bandeaux actifs, téléphones, ordre de la sphère."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalogue.tests.outils import MediasTemporairesMixin, image_png
from apps.contenus import services
from apps.contenus.models import Bandeau, PhotoSphere


class ServicesContenusTests(MediasTemporairesMixin, TestCase):
    def test_bandeaux_actifs(self):
        maintenant = timezone.now()
        visible = Bandeau.objects.create(texte="Promo")
        dans_dates = Bandeau.objects.create(texte="Salon", debut=maintenant - timedelta(days=1),
                                            fin=maintenant + timedelta(days=1))
        Bandeau.objects.create(texte="Inactif", actif=False)
        Bandeau.objects.create(texte="Fini", fin=maintenant - timedelta(hours=1))
        Bandeau.objects.create(texte="Futur", debut=maintenant + timedelta(hours=1))
        self.assertEqual(list(services.bandeaux_actifs()), [visible, dans_dates])

    def test_fin_avant_debut(self):
        maintenant = timezone.now()
        with self.assertRaises(ValidationError):
            services.enregistrer_bandeau(None, {"texte": "X", "debut": maintenant, "fin": maintenant})

    def test_telephones(self):
        self.assertEqual(services.valider_telephones([" +237  6 99 81 16 35 ", "", "+237 6 99 81 16 35"]),
                         ["+237 6 99 81 16 35"])
        for valeur in ("+237", ["abc"], [12], ["+237 6", "x"]):
            with self.subTest(valeur=valeur), self.assertRaises(ValidationError):
                services.valider_telephones(valeur)
        with self.assertRaises(ValidationError):
            services.valider_telephones([f"+237 6 00 00 00 0{i}" for i in range(7)])

    def test_ordre_sphere(self):
        a, b, c = (PhotoSphere.objects.create(image=image_png(), ordre=i) for i in range(3))
        services.ordonner_sphere([c.id, a.id])
        self.assertEqual(list(PhotoSphere.objects.values_list("id", flat=True)), [c.id, a.id, b.id])
        for ids in ([c.id, c.id], [999], ["x"]):
            with self.subTest(ids=ids), self.assertRaises(ValidationError):
                services.ordonner_sphere(ids)
