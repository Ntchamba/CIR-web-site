"""Webhooks CamPay : vérification de la signature (JWT HS256) et lecture tolérante des paramètres.

Réserve : le format exact des webhooks CamPay n'a pas pu être vérifié. On accepte donc GET ou POST,
paramètres de requête ou JSON. Rien de ce qui est lu ici n'est fiable : la réussite d'un paiement n'est
admise qu'après revérification auprès de l'API (`client.statut`).
"""
import json
import os
from dataclasses import dataclass

import jwt

LONGUEUR_MAX = 128


@dataclass(frozen=True)
class EvenementCampay:
    reference: str
    reference_externe: str
    statut_annonce: str


def _en_dict(parametres):
    """Accepte un dictionnaire, un QueryDict, ou un corps JSON (texte ou octets) ; sinon `{}`."""
    if isinstance(parametres, (bytes, bytearray)):
        try:
            parametres = bytes(parametres).decode("utf-8")
        except UnicodeDecodeError:
            return {}
    if isinstance(parametres, str):
        try:
            parametres = json.loads(parametres)
        except ValueError:
            return {}
    if hasattr(parametres, "get") and hasattr(parametres, "keys"):
        return {str(k): parametres.get(k) for k in parametres.keys()}
    return {}


def verifier_signature(parametres) -> bool:
    """Vrai si `signature` est un JWT HS256 valide signé avec CAMPAY_WEBHOOK_KEY."""
    cle = os.environ.get("CAMPAY_WEBHOOK_KEY", "").strip()
    if not cle:
        return False
    signature = _en_dict(parametres).get("signature")
    if not isinstance(signature, str) or not signature.strip():
        return False
    try:
        jwt.decode(signature.strip(), cle, algorithms=["HS256"])
    except (jwt.PyJWTError, ValueError, TypeError):
        return False
    return True


def _texte(valeur):
    if isinstance(valeur, bool) or not isinstance(valeur, (str, int)):
        return ""
    texte = str(valeur).strip()
    return texte if len(texte) <= LONGUEUR_MAX and texte.isprintable() else ""


def analyser(parametres):
    """Renvoie un `EvenementCampay` ou `None` si le corps est invalide ou sans référence."""
    donnees = _en_dict(parametres)
    reference = _texte(donnees.get("reference"))
    reference_externe = _texte(donnees.get("external_reference"))
    if not reference and not reference_externe:
        return None
    return EvenementCampay(reference=reference, reference_externe=reference_externe,
                           statut_annonce=_texte(donnees.get("status")).upper())
