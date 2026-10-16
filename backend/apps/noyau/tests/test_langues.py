"""Multilingue du noyau : codes de langue, traduction du contenu (vague 1 et suivantes), fichiers .po/.mo."""
import gettext
import tempfile
from pathlib import Path
from types import SimpleNamespace

from django.test import SimpleTestCase
from django.utils import translation
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.noyau.catalogues import catalogues, ecarts, ecrire_mo, extraire_messages, lire_po
from apps.noyau.images import ImageInvalide, convertir_en_webp
from apps.noyau.langues import AUTRES_LANGUES, CODES_LANGUES, Langue, code_court, code_django, langue_active
from apps.noyau.traductions import (SerialiseurTraductionsAdminMixin, SerialiseurTraduitMixin, TraductionsMixin,
                                    valider_traductions)


class FrancaisParDefautMixin:
    """La langue activée par une requête d'un autre test ne doit pas déborder sur ces tests."""

    def setUp(self):
        super().setUp()
        translation.activate("fr")
        self.addCleanup(translation.deactivate)


class LanguesTests(FrancaisParDefautMixin, SimpleTestCase):
    def test_cinq_langues_francais_en_premier(self):
        self.assertEqual(CODES_LANGUES, ("fr", "en", "zh", "de", "ja"))
        self.assertEqual(AUTRES_LANGUES, ("en", "zh", "de", "ja"))
        self.assertEqual(Langue.CHINOIS.label, "中文")

    def test_correspondance_avec_django(self):
        self.assertEqual(code_django("zh"), "zh-hans")
        self.assertEqual(code_django("de"), "de")
        for etiquette, attendu in [("zh-hans", "zh"), ("zh-CN", "zh"), ("en-us", "en"), ("DE", "de"),
                                   ("ja_JP", "ja"), ("es", "fr"), ("", "fr"), (None, "fr")]:
            with self.subTest(etiquette=etiquette):
                self.assertEqual(code_court(etiquette), attendu)

    def test_langue_active(self):
        self.assertEqual(langue_active(), "fr")
        with translation.override("zh-hans"):
            self.assertEqual(langue_active(), "zh")
        with translation.override("ja"):
            self.assertEqual(langue_active(), "ja")


class Fiche(TraductionsMixin):
    """Objet de test : se comporte comme un modèle avec un champ `traductions`."""

    champs_traduits = ("nom", "description")

    def __init__(self, nom, description="", traductions=None):
        self.nom, self.description, self.traductions = nom, description, traductions or {}


class FicheSerializer(SerialiseurTraduitMixin, serializers.Serializer):
    nom = serializers.CharField()
    description = serializers.CharField()
    traductions = serializers.JSONField()


class FicheAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.Serializer):
    nom = serializers.CharField()
    traductions = serializers.JSONField(required=False)

    class Meta:
        model = Fiche


class TraductionsContenuTests(FrancaisParDefautMixin, SimpleTestCase):
    def setUp(self):
        super().setUp()
        self.fiche = Fiche("Époxy autolissant", "Sol lisse et brillant.",
                           {"en": {"nom": "Self-levelling epoxy", "description": "  "}, "zh": {"nom": "自流平环氧地坪"}})

    def test_traduit_avec_secours_en_francais(self):
        self.assertEqual(self.fiche.traduit("nom", "en"), "Self-levelling epoxy")
        self.assertEqual(self.fiche.traduit("description", "en"), "Sol lisse et brillant.")  # vide → français
        self.assertEqual(self.fiche.traduit("nom", "de"), "Époxy autolissant")  # absente → français
        self.assertEqual(self.fiche.traduit("nom", "zh-hans"), "自流平环氧地坪")
        self.assertEqual(self.fiche.traduit("nom", "fr"), "Époxy autolissant")
        with translation.override("zh-hans"):
            self.assertEqual(self.fiche.traduit("nom"), "自流平环氧地坪")
        self.assertEqual(Fiche("Nom", traductions=None).traduit("nom", "ja"), "Nom")

    def test_langues_incompletes(self):
        self.assertEqual(self.fiche.langues_incompletes(), ["en", "zh", "de", "ja"])
        complet = {code: {"nom": "x", "description": "y"} for code in AUTRES_LANGUES}
        self.assertEqual(Fiche("Nom", "Texte", complet).langues_incompletes(), [])
        # description vide en français : rien à traduire pour ce champ
        self.assertEqual(Fiche("Nom", "", {c: {"nom": "x"} for c in AUTRES_LANGUES}).langues_incompletes(), [])

    def test_valider_traductions(self):
        propres = valider_traductions(
            {"en": {"nom": "  Epoxy  ", "description": ""}, "de": {"nom": None}, "ja": {}}, ("nom", "description"))
        self.assertEqual(propres, {"en": {"nom": "Epoxy"}})
        self.assertEqual(valider_traductions(None, ("nom",)), {})
        self.assertEqual(valider_traductions("", ("nom",)), {})

    def test_valider_traductions_refus(self):
        for valeur in (["en"], {"fr": {"nom": "x"}}, {"es": {"nom": "x"}}, {"en": "x"},
                       {"en": {"prix": "x"}}, {"en": {"nom": 12}}):
            with self.subTest(valeur=valeur), self.assertRaises(ValidationError):
                valider_traductions(valeur, ("nom", "description"))

    def test_message_de_refus_traduit(self):
        with translation.override("en"), self.assertRaises(ValidationError) as contexte:
            valider_traductions({"es": {"nom": "x"}}, ("nom",))
        self.assertEqual(str(contexte.exception.detail[0]), "Unsupported language: es.")

    def test_serialiseur_public_dans_la_langue_de_la_requete(self):
        with translation.override("en"):
            donnees = FicheSerializer(self.fiche).data
        self.assertEqual(donnees, {"nom": "Self-levelling epoxy", "description": "Sol lisse et brillant."})
        self.assertNotIn("traductions", FicheSerializer(self.fiche).data)
        self.assertEqual(FicheSerializer(self.fiche).data["nom"], "Époxy autolissant")

    def test_serialiseur_admin(self):
        donnees = FicheAdminSerializer(self.fiche).data
        self.assertEqual(donnees["traductions"]["en"]["nom"], "Self-levelling epoxy")
        self.assertEqual(donnees["langues_incompletes"], ["en", "zh", "de", "ja"])
        s = FicheAdminSerializer(data={"nom": "x", "traductions": {"en": {"nom": " Floor "}}})
        self.assertTrue(s.is_valid(), s.errors)
        self.assertEqual(s.validated_data["traductions"], {"en": {"nom": "Floor"}})
        s = FicheAdminSerializer(data={"nom": "x", "traductions": {"en": {"prix": "1"}}})
        self.assertFalse(s.is_valid())
        self.assertIn("traductions", s.errors)


class FichiersDeTraductionTests(SimpleTestCase):
    def test_tous_les_messages_traduits_et_compiles(self):
        """Un message ajouté dans le code sans traduction (ou un .mo oublié) fait échouer ce test."""
        self.assertEqual(ecarts(), [])

    def test_quatre_langues(self):
        self.assertEqual(set(catalogues()), {"en", "zh_Hans", "de", "ja"})

    def test_extraction_des_messages(self):
        messages = extraire_messages()
        self.assertIn("E-mail ou mot de passe incorrect.", messages)
        self.assertIn("Accès réservé à l'équipe du CIR.", messages)
        self.assertTrue(all(":" in p for positions in messages.values() for p in positions))

    def test_lecture_po_et_mo_lisible_par_gettext(self):
        with tempfile.TemporaryDirectory() as dossier:
            po = Path(dossier) / "essai.po"
            po.write_text(
                'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n'
                '# commentaire\nmsgid "Bonjour \\"toi\\""\nmsgstr ""\n"Hello "\n"\\"you\\""\n\n'
                'msgid "Vide"\nmsgstr ""\n', encoding="utf-8")
            entrees = lire_po(po)
            self.assertEqual(entrees['Bonjour "toi"'], 'Hello "you"')
            mo = Path(dossier) / "essai.mo"
            ecrire_mo(entrees, mo)
            with mo.open("rb") as f:
                traductions = gettext.GNUTranslations(f)
            self.assertEqual(traductions.gettext('Bonjour "toi"'), 'Hello "you"')
            self.assertEqual(traductions.gettext("Vide"), "Vide")  # non traduit : texte d'origine

    def test_messages_traduits_par_django(self):
        with translation.override("ja"):
            with self.assertRaises(ImageInvalide) as contexte:
                convertir_en_webp(SimpleNamespace(size=11 * 1024 * 1024))
        self.assertEqual(str(contexte.exception), "画像のサイズが大きすぎます（最大 10 MB）。")
        with translation.override("de"):
            from apps.noyau.permissions import EstEquipe
            self.assertEqual(str(EstEquipe.message), "Zugriff nur für das CIR-Team.")
