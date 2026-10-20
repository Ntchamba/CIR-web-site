"""Jetons JWT JaaS (Jitsi as a Service) : signature RS256, rôle modérateur.

Les clés viennent uniquement des variables d'environnement. Aucune clé n'est écrite
dans un message d'erreur ni dans un journal.
"""
import os
import re
import time

import jwt
from cryptography.hazmat.primitives.serialization import load_pem_private_key

from .erreurs import JaasNonConfigure, JaasSalleInvalide

DOMAINE = "8x8.vc"
_MOTIF_SALLE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def _cle_privee_pem() -> str:
    """Lit la clé PEM ; les retours à la ligne écrits `\\n` sont convertis."""
    return os.environ.get("JAAS_PRIVATE_KEY", "").strip().replace("\\n", "\n")


def _cle_lisible(pem: str) -> bool:
    try:
        load_pem_private_key(pem.encode("utf-8"), password=None)
    except Exception:  # clé absente, mal formée, chiffrée : jamais de détail (pas de fuite)
        return False
    return True


def configure() -> bool:
    """Vrai si les trois variables sont présentes et la clé privée est lisible."""
    if not (os.environ.get("JAAS_APP_ID") and os.environ.get("JAAS_KEY_ID")):
        return False
    pem = _cle_privee_pem()
    return bool(pem) and _cle_lisible(pem)


def parametres_client() -> dict:
    """Paramètres publics pour charger `https://<domaine>/<app_id>/external_api.js`."""
    return {"domaine": DOMAINE, "app_id": os.environ.get("JAAS_APP_ID", "")}


def creer_jeton(*, salle, utilisateur_id, nom, email="", moderateur=False, duree_secondes=7200) -> str:
    """Crée un JWT JaaS signé RS256 pour une salle donnée."""
    if not configure():
        raise JaasNonConfigure("Les appels vidéo ne sont pas configurés.")
    if not isinstance(salle, str) or not _MOTIF_SALLE.match(salle):
        raise JaasSalleInvalide("Nom de salle invalide.")
    app_id = os.environ["JAAS_APP_ID"]
    maintenant = int(time.time())
    charge = {
        "aud": "jitsi",
        "iss": "chat",
        "sub": app_id,
        "room": salle,
        "nbf": maintenant - 10,
        "exp": maintenant + int(duree_secondes),
        "context": {
            "user": {
                "id": str(utilisateur_id),
                "name": nom,
                "email": email,
                "moderator": "true" if moderateur else "false",
            },
            "features": {
                "recording": "false",
                "livestreaming": "false",
                "transcription": "false",
                "outbound-call": "false",
            },
        },
    }
    jeton = jwt.encode(
        charge,
        _cle_privee_pem(),
        algorithm="RS256",
        headers={"kid": os.environ["JAAS_KEY_ID"], "typ": "JWT"},
    )
    return jeton if isinstance(jeton, str) else jeton.decode("ascii")
