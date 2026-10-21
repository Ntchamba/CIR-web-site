"""Tests des déclarations de fonctions Gemini."""
from unittest import TestCase

from integrations.gemini.erreurs import GeminiErreurDefinitive
from integrations.gemini.outils import declarer


class DeclarerTests(TestCase):
    def test_declaration_complete(self):
        d = declarer("chercher_produits", "Cherche des produits.", {
            "recherche": {"type": "string", "description": "Mot-clé"},
            "limite": {"type": "integer", "description": "Nombre"},
            "actif": {"type": "boolean", "description": "Actifs"},
            "usage": {"type": "string", "description": "Usage", "enum": ["maison", "industrie"]}})
        self.assertEqual(d["name"], "chercher_produits")
        self.assertEqual(d["parameters"]["type"], "OBJECT")
        p = d["parameters"]["properties"]
        self.assertEqual([p[k]["type"] for k in ("recherche", "limite", "actif")],
                         ["STRING", "INTEGER", "BOOLEAN"])
        self.assertEqual(p["usage"]["enum"], ["maison", "industrie"])
        self.assertEqual(d["parameters"]["required"], ["recherche", "limite", "actif", "usage"])

    def test_sans_parametre(self):
        d = declarer("lister_categories", "Liste.", {})
        self.assertNotIn("parameters", d)

    def test_noms_refuses(self):
        for nom in ("Ab", "ab", "1abc", "a-bc", "Abc", "a" * 42, "", None, "abc def"):
            with self.assertRaises(GeminiErreurDefinitive, msg=repr(nom)):
                declarer(nom, "d", {})

    def test_schema_refuse(self):
        for params in ({"x": {"type": "float"}}, {"X": {"type": "string"}}, {"x": "string"},
                       {"x": {"type": "integer", "enum": ["a"]}}, {"x": {"type": "string", "enum": []}}):
            with self.assertRaises(GeminiErreurDefinitive, msg=repr(params)):
                declarer("outil_test", "d", params)

    def test_description_obligatoire(self):
        with self.assertRaises(GeminiErreurDefinitive):
            declarer("outil_test", "  ", {})
