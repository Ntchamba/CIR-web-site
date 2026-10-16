"""Règles des contenus : bandeaux actifs, téléphones, ordre de la sphère."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalogue.tests.outils import MediasTemporairesMixin, image_png
from apps.contenus import services
from apps.contenus.models import Bandeau, PhotoSphere


class ServicesContenusTests(MediasTemporairesMixin, TestCase):
    def test_bandeaux_actifs_fin_incluse(self):
        aujourd_hui = timezone.localdate()
        visible = Bandeau.objects.create(texte="Promo")
        dans_dates = Bandeau.objects.create(texte="Salon", debut=aujourd_hui - timedelta(days=1),
                                            fin=aujourd_hui + timedelta(days=1))
        un_jour = Bandeau.objects.create(texte="Aujourd'hui", debut=aujourd_hui, fin=aujourd_hui)
        Bandeau.objects.create(texte="Inactif", actif=False)
        Bandeau.objects.create(texte="Fini hier", fin=aujourd_hui - timedelta(days=1))
        Bandeau.objects.create(texte="Demain", debut=aujourd_hui + timedelta(days=1))
        self.assertEqual(list(services.bandeaux_actifs()), [visible, dans_dates, un_jour])

    def test_fin_avant_debut(self):
        aujourd_hui = timezone.localdate()
        b = services.enregistrer_bandeau(None, {"texte": "X", "debut": aujourd_hui, "fin": aujourd_hui})
        self.assertEqual(b.fin, b.debut)  # un seul jour : accepté
        with self.assertRaises(ValidationError) as contexte:
            services.enregistrer_bandeau(None, {"texte": "X", "debut": aujourd_hui,
                                                "fin": aujourd_hui - timedelta(days=1)})
        self.assertIn("fin", contexte.exception.detail)

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
