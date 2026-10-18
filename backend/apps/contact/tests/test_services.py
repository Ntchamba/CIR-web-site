from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.contact import services
from apps.contact.models import DemandeContact


class ServicesTests(TestCase):
    def test_creer_demande_visiteur_nettoie(self):
        d = services.creer_demande({"nom": "  Jean   Dupont ", "email": " J@X.CM ", "message": " Bonjour ! ",
                                    "type": "question"})
        self.assertEqual((d.nom, d.email, d.message), ("Jean Dupont", "j@x.cm", "Bonjour !"))

    def test_refus_sans_nom(self):
        with self.assertRaises(ValidationError):
            services.creer_demande({"email": "a@x.cm", "message": "Bonjour", "type": "question"})
        self.assertEqual(DemandeContact.objects.count(), 0)

    def test_faux_succes(self):
        self.assertEqual(set(services.faux_succes()), {"id", "reference"})
