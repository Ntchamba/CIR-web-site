"""Webhooks JaaS : vérification du secret partagé et lecture des événements."""
import hmac
import json
import os
from dataclasses import dataclass

TYPES_RETENUS = {"ROOM_CREATED", "PARTICIPANT_JOINED", "PARTICIPANT_LEFT", "ROOM_DESTROYED"}


@dataclass(frozen=True)
class EvenementJaas:
    type: str
    salle: str
    participant_id: str = ""
    horodatage: object = None


def _entete(entetes, nom):
    """Lecture insensible à la casse (aussi pour les clés `HTTP_X_WEBHOOK_SECRET` de Django)."""
    if not entetes:
        return ""
    cible = nom.lower().replace("-", "_")
    for cle, valeur in entetes.items():
        k = str(cle).lower().replace("-", "_")
        if k == cible or k == "http_" + cible:
            return valeur if isinstance(valeur, str) else str(valeur)
    return ""


def verifier(entetes, corps) -> bool:
    """Compare en temps constant le secret reçu à JAAS_WEBHOOK_SECRET (faux si non configuré)."""
    secret = os.environ.get("JAAS_WEBHOOK_SECRET", "")
    if not secret:
        return False
    recu = _entete(entetes, "X-Webhook-Secret").strip()
    if not recu:
        autorisation = _entete(entetes, "Authorization").strip()
        if autorisation.lower().startswith("bearer "):
            recu = autorisation[7:].strip()
    if not recu:
        return False
    return hmac.compare_digest(recu.encode("utf-8"), secret.encode("utf-8"))


def analyser(corps) -> list:
    """Extrait les événements connus ; le reste est ignoré, un corps invalide donne une liste vide."""
    try:
        if isinstance(corps, (bytes, bytearray)):
            corps = bytes(corps).decode("utf-8")
        donnees = json.loads(corps) if isinstance(corps, str) else corps
    except (ValueError, UnicodeDecodeError):
        return []
    elements = donnees if isinstance(donnees, list) else [donnees]
    resultat = []
    for element in elements:
        if not isinstance(element, dict):
            continue
        type_ = element.get("eventType")
        if type_ not in TYPES_RETENUS:
            continue
        data = element.get("data") if isinstance(element.get("data"), dict) else {}
        salle = element.get("fqn") or data.get("fqn") or data.get("conference") or ""
        # Le nom complet JaaS est « <app_id>/<salle> » : on garde la salle seule.
        salle = str(salle).split("/")[-1]
        participant = data.get("participantId") or data.get("participant_id") or ""
        if not participant and isinstance(data.get("participant"), dict):
            participant = data["participant"].get("id", "")
        resultat.append(EvenementJaas(
            type=type_,
            salle=salle,
            participant_id=str(participant),
            horodatage=element.get("timestamp"),
        ))
    return resultat
