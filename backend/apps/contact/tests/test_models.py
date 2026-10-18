from django.test import TestCase

from apps.contact.models import DemandeContact


class DemandeContactTests(TestCase):
    def test_references_sequentielles(self):
        a = DemandeContact.objects.create(nom="A", email="a@x.cm", message="Bonjour")
        b = DemandeContact.objects.create(nom="B", email="b@x.cm", message="Bonjour")
        self.assertRegex(a.reference, r"^CTC-\d{4}-0001$")
        self.assertTrue(b.reference.endswith("-0002"))
        self.assertEqual(str(a), a.reference)
