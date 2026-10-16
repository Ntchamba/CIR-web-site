"""Langues de la plateforme (fiche de décision 7) : français (référence), anglais, chinois simplifié,
allemand, japonais.

Le site et le tableau de bord utilisent des codes courts (fr, en, zh, de, ja), rangés tels quels en base
(langue préférée d'un compte, clés des traductions de contenu). Django nomme le chinois simplifié
« zh-hans » : les fonctions ci-dessous font la correspondance.
"""
from django.db import models
from django.utils import translation

LANGUE_PAR_DEFAUT = "fr"


class Langue(models.TextChoices):
    # Noms écrits dans leur propre langue : reconnaissables quelle que soit la langue de l'interface.
    FRANCAIS = "fr", "Français"
    ANGLAIS = "en", "English"
    CHINOIS = "zh", "中文"
    ALLEMAND = "de", "Deutsch"
    JAPONAIS = "ja", "日本語"


CODES_LANGUES = tuple(Langue.values)
AUTRES_LANGUES = tuple(code for code in CODES_LANGUES if code != LANGUE_PAR_DEFAUT)

# Code court → code Django (LANGUAGES dans config/settings/base.py)
_VERS_DJANGO = {"zh": "zh-hans"}


def code_django(code):
    """« zh » → « zh-hans » ; les autres codes sont identiques."""
    return _VERS_DJANGO.get(code, code)


def code_court(langue):
    """Code court d'une langue Django ou d'une étiquette quelconque (« zh-hans », « en-us », « DE »).

    Renvoie le français si la langue n'est pas proposée.
    """
    base = str(langue or "").strip().lower().replace("_", "-").split("-")[0]
    return base if base in CODES_LANGUES else LANGUE_PAR_DEFAUT


def langue_active():
    """Code court de la langue de la requête en cours (activée par LocaleMiddleware)."""
    return code_court(translation.get_language())
