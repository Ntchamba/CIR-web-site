"""Santé du serveur : GET /api/sante/ (sonde de Railway et supervision)."""
import logging

from django.db import connection
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

journal = logging.getLogger("cir")


def base_de_donnees_accessible():
    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        return True
    except Exception:  # noqa: BLE001 - la sonde doit répondre même si la base est tombée
        journal.exception("Base de données inaccessible")
        return False


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def sante(request):
    base_ok = base_de_donnees_accessible()
    return Response(
        {"statut": "ok" if base_ok else "degrade", "base_de_donnees": base_ok},
        status=200 if base_ok else 503,
    )
