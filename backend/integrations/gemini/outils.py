"""Déclaration des fonctions que le modèle peut demander (format Gemini).

L'intégration ne fait que déclarer : elle n'exécute jamais une fonction demandée par le modèle.
"""
import re

from .erreurs import GeminiErreurDefinitive

_NOM_FONCTION = re.compile(r"^[a-z][a-z0-9_]{2,40}$")
_NOM_PARAMETRE = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
_TYPES = {"string": "STRING", "integer": "INTEGER", "boolean": "BOOLEAN"}


def declarer(nom, description, parametres=None) -> dict:
    """Construit une déclaration de fonction à partir d'un schéma simple.

    `parametres` : `{nom_param: {"type": "string"|"integer"|"boolean", "description": "…", "enum"?: [...]}}`.
    Tous les paramètres déclarés sont obligatoires (`required`).
    """
    if not isinstance(nom, str) or not _NOM_FONCTION.fullmatch(nom):
        raise GeminiErreurDefinitive("Nom de fonction invalide.")
    if not isinstance(description, str) or not description.strip():
        raise GeminiErreurDefinitive("Description de fonction manquante.")
    if parametres is not None and not isinstance(parametres, dict):
        raise GeminiErreurDefinitive("Schéma de paramètres invalide.")
    proprietes = {}
    for cle, schema in (parametres or {}).items():
        if not isinstance(cle, str) or not _NOM_PARAMETRE.fullmatch(cle):
            raise GeminiErreurDefinitive("Nom de paramètre invalide.")
        if not isinstance(schema, dict) or schema.get("type") not in _TYPES:
            raise GeminiErreurDefinitive(f"Type du paramètre « {cle} » invalide.")
        propriete = {"type": _TYPES[schema["type"]], "description": str(schema.get("description", ""))}
        if "enum" in schema:
            valeurs = schema["enum"]
            if not isinstance(valeurs, (list, tuple)) or not valeurs or \
                    not all(isinstance(v, str) for v in valeurs):
                raise GeminiErreurDefinitive(f"Valeurs permises du paramètre « {cle} » invalides.")
            if schema["type"] != "string":
                raise GeminiErreurDefinitive(f"« enum » réservé aux paramètres texte (« {cle} »).")
            propriete["enum"] = list(valeurs)
        proprietes[cle] = propriete
    declaration = {"name": nom, "description": description.strip()}
    if proprietes:  # Gemini refuse un objet de paramètres sans propriété
        declaration["parameters"] = {"type": "OBJECT", "properties": proprietes,
                                     "required": list(proprietes)}
    return declaration
