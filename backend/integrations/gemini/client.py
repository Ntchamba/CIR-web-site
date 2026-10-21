"""Client minimal de l'API Gemini (generateContent) pour l'assistant IA.

La clé vient de GEMINI_API_KEY ; elle est envoyée dans l'en-tête `x-goog-api-key` et n'apparaît ni
dans l'adresse, ni dans les erreurs, ni dans les journaux. Le texte de l'utilisateur non plus.
Un appel de fonction renvoyé par le modèle est une demande : cette intégration n'exécute rien.
"""
import json
import logging
import os
import re
from dataclasses import dataclass, field

import requests

from .erreurs import (GeminiContenuBloque, GeminiErreurDefinitive, GeminiErreurTemporaire,
                      GeminiNonConfigure)

journal = logging.getLogger(__name__)

BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_MODELE = re.compile(r"^[a-z0-9][a-z0-9.\-]{2,60}$")
_ROLES = ("user", "model", "function")
_CATEGORIES = ("HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH",
               "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT")
_FINS_BLOQUEES = {"SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "RECITATION", "IMAGE_SAFETY"}


@dataclass(frozen=True)
class AppelOutil:
    nom: str
    arguments: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Reponse:
    texte: str
    appels: list
    jetons_entree: int
    jetons_sortie: int
    raison_fin: str


def configure() -> bool:
    """Vrai si GEMINI_API_KEY est présente."""
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _parties(message) -> dict:
    """Convertit un message du contrat en contenu Gemini."""
    if not isinstance(message, dict) or message.get("role") not in _ROLES:
        raise GeminiErreurDefinitive("Message invalide : rôle inconnu.")
    role = message["role"]
    parties = []
    texte = message.get("texte")
    if texte:
        if not isinstance(texte, str):
            raise GeminiErreurDefinitive("Message invalide : texte attendu.")
        parties.append({"text": texte})
    appel = message.get("appel")
    if appel:
        if role != "model" or not isinstance(appel, dict) or not isinstance(appel.get("nom"), str):
            raise GeminiErreurDefinitive("Message invalide : appel de fonction mal formé.")
        parties.append({"functionCall": {"name": appel["nom"], "args": dict(appel.get("arguments") or {})}})
    resultat = message.get("resultat")
    if resultat:
        if role != "function" or not isinstance(resultat, dict) or not isinstance(resultat.get("nom"), str):
            raise GeminiErreurDefinitive("Message invalide : résultat de fonction mal formé.")
        parties.append({"functionResponse": {"name": resultat["nom"],
                                             "response": {"result": resultat.get("contenu")}}})
    if not parties:
        raise GeminiErreurDefinitive("Message invalide : contenu vide.")
    # Les résultats de fonction sont envoyés avec le rôle « user » (format v1beta actuel).
    return {"role": "user" if role == "function" else role, "parts": parties}


def _corps(instruction, messages, outils, temperature, jetons_max) -> dict:
    corps = {
        "contents": [_parties(m) for m in messages],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": jetons_max},
        "safetySettings": [{"category": c, "threshold": "BLOCK_MEDIUM_AND_ABOVE"} for c in _CATEGORIES],
    }
    if not corps["contents"]:
        raise GeminiErreurDefinitive("Aucun message à envoyer.")
    if instruction:
        corps["systemInstruction"] = {"parts": [{"text": str(instruction)}]}
    if outils:
        corps["tools"] = [{"functionDeclarations": list(outils)}]
        corps["toolConfig"] = {"functionCallingConfig": {"mode": "AUTO"}}
    return corps


def _entier(valeur) -> int:
    return valeur if isinstance(valeur, int) and not isinstance(valeur, bool) and valeur >= 0 else 0


def _analyser(donnees) -> Reponse:
    if not isinstance(donnees, dict):
        raise GeminiErreurTemporaire("Réponse inattendue du service Gemini.")
    retour = donnees.get("promptFeedback")
    if isinstance(retour, dict) and retour.get("blockReason"):
        raise GeminiContenuBloque("Requête bloquée par les réglages de sécurité de Gemini.")
    candidates = donnees.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise GeminiContenuBloque("Aucune réponse proposée par Gemini.")
    candidate = candidates[0]
    if not isinstance(candidate, dict):
        raise GeminiErreurTemporaire("Réponse inattendue du service Gemini.")
    fin = str(candidate.get("finishReason") or "")
    contenu = candidate.get("content")
    parties = contenu.get("parts") if isinstance(contenu, dict) else None
    if fin in _FINS_BLOQUEES:
        raise GeminiContenuBloque("Réponse bloquée par les réglages de sécurité de Gemini.")
    if parties is None:
        parties = []
    if not isinstance(parties, list):
        raise GeminiErreurTemporaire("Réponse inattendue du service Gemini.")
    textes, appels = [], []
    for partie in parties:
        if not isinstance(partie, dict):
            raise GeminiErreurTemporaire("Réponse inattendue du service Gemini.")
        if isinstance(partie.get("functionCall"), dict):
            appel = partie["functionCall"]
            nom, arguments = appel.get("name"), appel.get("args") or {}
            if not isinstance(nom, str) or not nom or not isinstance(arguments, dict):
                raise GeminiErreurTemporaire("Réponse inattendue du service Gemini.")
            appels.append(AppelOutil(nom=nom, arguments=arguments))
        elif isinstance(partie.get("text"), str) and not partie.get("thought"):
            textes.append(partie["text"])
    usage = donnees.get("usageMetadata")
    usage = usage if isinstance(usage, dict) else {}
    return Reponse(texte="".join(textes), appels=appels,
                   jetons_entree=_entier(usage.get("promptTokenCount")),
                   jetons_sortie=_entier(usage.get("candidatesTokenCount")),
                   raison_fin=fin)


def generer(*, modele, instruction, messages, outils=(), temperature=0.2, jetons_max=800,
            delai=30) -> Reponse:
    """Envoie la conversation à Gemini et renvoie la réponse (texte et/ou appels de fonctions demandés)."""
    if not configure():
        raise GeminiNonConfigure("L'assistant IA (Gemini) n'est pas configuré.")
    if not isinstance(modele, str) or not _MODELE.fullmatch(modele):
        raise GeminiErreurDefinitive("Nom de modèle Gemini invalide.")
    if isinstance(delai, bool) or not isinstance(delai, (int, float)) or delai <= 0:
        raise GeminiErreurDefinitive("Délai d'attente invalide.")
    try:
        corps = _corps(instruction, messages, outils, temperature, jetons_max)
        json.dumps(corps)  # contenu non sérialisable (Decimal, date…) : refusé proprement
    except (TypeError, ValueError):
        raise GeminiErreurDefinitive("Contenu de requête non sérialisable.") from None
    try:
        reponse = requests.post(f"{BASE}/{modele}:generateContent", json=corps, timeout=delai,
                                headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"].strip(),
                                         "Content-Type": "application/json"})
    except requests.RequestException:
        raise GeminiErreurTemporaire("Service Gemini injoignable.") from None
    except UnicodeError:  # clé avec caractères hors latin-1 : configuration à corriger
        raise GeminiErreurDefinitive("Clé Gemini inutilisable : vérifier la configuration.") from None
    code = reponse.status_code
    if code == 429 or code >= 500:
        raise GeminiErreurTemporaire(f"Service Gemini indisponible (code {code}).")
    if code in (401, 403):
        raise GeminiErreurDefinitive(f"Accès Gemini refusé (code {code}) : vérifier la configuration.")
    if code != 200:
        raise GeminiErreurDefinitive(f"Requête refusée par Gemini (code {code}).")
    try:
        donnees = reponse.json()
    except ValueError:
        raise GeminiErreurTemporaire("Réponse illisible du service Gemini.") from None
    resultat = _analyser(donnees)
    journal.info("Appel Gemini : modèle %s, %d jetons en entrée, %d en sortie, %d appel(s) d'outil.",
                 modele, resultat.jetons_entree, resultat.jetons_sortie, len(resultat.appels))
    return resultat
