"""Permissions communes à toutes les API du CIR."""
from django.utils.translation import gettext
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission


def _connecte(request):
    return bool(request.user and request.user.is_authenticated and request.user.is_active)


class EstEquipe(BasePermission):
    """Réservé aux membres de l'équipe (rôle « membre » ou « super_admin ») : API du tableau de bord."""

    message = _("Accès réservé à l'équipe du CIR.")

    def has_permission(self, request, view):
        return _connecte(request) and getattr(request.user, "est_equipe", False)


class EstClient(BasePermission):
    """Réservé aux clients connectés (rôle « client », compte actif) : sélection, commandes, demandes, devis.

    Un compte de l'équipe reçoit 403 `{"detail": "…", "code": "compte_equipe"}` : il passe par `/api/admin/…`.
    Un visiteur sans jeton reçoit 401 (le site l'invite à se connecter).
    """

    message = _("Accès réservé aux clients.")

    def has_permission(self, request, view):
        if not _connecte(request):
            return False
        if getattr(request.user, "est_equipe", False):
            raise PermissionDenied({"detail": gettext("Les comptes de l'équipe n'utilisent pas cette fonction : "
                                                      "passez par le tableau de bord."),
                                    "code": "compte_equipe"})
        return True


class EstSuperAdmin(BasePermission):
    """Réservé aux super-administrateurs (gestion des comptes de l'équipe, BF-17)."""

    message = _("Accès réservé aux super-administrateurs.")

    def has_permission(self, request, view):
        return _connecte(request) and getattr(request.user, "est_super_admin", False)


class LectureSeule(BasePermission):
    """Autorise uniquement les méthodes de lecture (GET, HEAD, OPTIONS)."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
