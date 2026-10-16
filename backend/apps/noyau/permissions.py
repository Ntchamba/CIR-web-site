"""Permissions communes à toutes les API du CIR."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


def _connecte(request):
    return bool(request.user and request.user.is_authenticated and request.user.is_active)


class EstEquipe(BasePermission):
    """Réservé aux membres de l'équipe (rôle « membre » ou « super_admin ») : API du tableau de bord."""

    message = "Accès réservé à l'équipe du CIR."

    def has_permission(self, request, view):
        return _connecte(request) and getattr(request.user, "est_equipe", False)


class EstSuperAdmin(BasePermission):
    """Réservé aux super-administrateurs (gestion des comptes de l'équipe, BF-17)."""

    message = "Accès réservé aux super-administrateurs."

    def has_permission(self, request, view):
        return _connecte(request) and getattr(request.user, "est_super_admin", False)


class LectureSeule(BasePermission):
    """Autorise uniquement les méthodes de lecture (GET, HEAD, OPTIONS)."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
