"""Tests de la normalisation et du masquage des numéros."""
from unittest import TestCase

from integrations.campay.telephone import TelephoneInvalide, masquer, normaliser


class TelephoneTests(TestCase):
    def test_formats_acceptes(self):
        for texte in ("6 99 00 11 22", "+237 699001122", "00237699001122", "237699001122",
                      "699001122", "+237 6 99-00.11.22", "(237) 699 001 122"):
            self.assertEqual(normaliser(texte), "237699001122", texte)

    def test_formats_refuses(self):
        for texte in ("", "abc", "+237 299001122", "69900112", "6990011223", "+33699001122",
                      "237 6990011220", "+237+699001122", "٦٩٩٠٠١١٢٢", None, 699001122):
            with self.assertRaises(TelephoneInvalide, msg=str(texte)):
                normaliser(texte)

    def test_hérite_de_valueerror(self):
        self.assertTrue(issubclass(TelephoneInvalide, ValueError))

    def test_masquer(self):
        self.assertEqual(masquer("237699001122"), "+237 6** ** ** 22")
        self.assertEqual(masquer("6 99 00 11 22"), "+237 6** ** ** 22")
        self.assertNotIn("9900", masquer("699001122"))
        self.assertNotIn("1122", masquer("not-a-number"))
