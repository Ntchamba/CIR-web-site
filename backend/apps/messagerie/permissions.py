"""Permissions de la messagerie (les permissions communes sont dans apps.noyau.permissions)."""
from rest_framework.permissions import BasePermission

from apps.noyau.permissions import EstClient, EstEquipe  # noqa: F401 (réexport pour le module)


class EstConnecte(BasePermission):
    """Tout compte actif (client ou équipe) : le droit réel est vérifié par le service (404 sinon)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)
