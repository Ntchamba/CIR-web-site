"""Permissions de la vitrine."""
from django.utils.translation import gettext_lazy as _
from rest_framework.permissions import BasePermission

from apps.noyau.permissions import EstEquipe  # noqa: F401 (réexport pour le module)

from . import services


class EstClientConnecte(BasePermission):
    """Client connecté (pas un compte de l'équipe) : dépôt d'un témoignage."""

    message = _("Seuls les clients connectés peuvent déposer un témoignage.")

    def has_permission(self, request, view):
        return services.peut_temoigner(request.user)
