from rest_framework.permissions import SAFE_METHODS, BasePermission


class EstEquipe(BasePermission):
    """Réservé aux membres de l'équipe du CIR (comptes « is_staff ») : API du tableau de bord."""

    message = "Accès réservé à l'équipe du CIR."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class EstSuperAdministrateur(BasePermission):
    """Gestion des comptes de l'équipe (BF-17) : réservé aux super-administrateurs."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class LectureSeule(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
