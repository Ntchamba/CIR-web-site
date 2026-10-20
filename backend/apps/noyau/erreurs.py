"""Erreurs d'API avec un code lisible par les front-ends : `{"detail": "…", "code": "<code>"}`."""
from rest_framework import status
from rest_framework.exceptions import APIException, Throttled


class ErreurAvecCode(APIException):
    """Erreur HTTP dont la réponse contient `detail` (texte traduit) et `code` (pour réagir côté front)."""

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail, code, statut=None):
        if statut is not None:
            self.status_code = statut
        super().__init__({"detail": detail, "code": code})


def conflit(detail, code):
    """409 : l'action est impossible dans l'état actuel (ex. appel déjà pris)."""
    return ErreurAvecCode(detail, code, status.HTTP_409_CONFLICT)


def indisponible(detail, code):
    """503 : service non configuré ou en panne (le reste de l'application reste utilisable)."""
    return ErreurAvecCode(detail, code, status.HTTP_503_SERVICE_UNAVAILABLE)


def trop_de_demandes(detail, code):
    """429 avec un code (quotas)."""
    return Throttled(detail={"detail": detail, "code": code})


def code_et_detail(erreur):
    """(code, texte) d'une exception d'API (DRF) : sert aux réponses du WebSocket."""
    detail = getattr(erreur, "detail", None)
    if isinstance(detail, dict):
        if "code" in detail and "detail" in detail:
            return str(detail["code"]), str(detail["detail"])
        for valeur in detail.values():
            premier = valeur[0] if isinstance(valeur, (list, tuple)) and valeur else valeur
            return str(getattr(premier, "code", "") or "format_invalide"), str(premier)
    if isinstance(detail, (list, tuple)) and detail:
        premier = detail[0]
        return str(getattr(premier, "code", "") or "format_invalide"), str(premier)
    return str(getattr(detail, "code", "") or "format_invalide"), str(detail or "")
