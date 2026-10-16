"""Rôles des comptes : client (site public), membre et super-administrateur (équipe du CIR)."""
from django.db import models
from django.utils.translation import gettext_lazy as _


class Role(models.TextChoices):
    CLIENT = "client", _("Client")
    MEMBRE = "membre", _("Membre de l'équipe")
    SUPER_ADMIN = "super_admin", _("Super-administrateur")


ROLES_EQUIPE = (Role.MEMBRE, Role.SUPER_ADMIN)


def est_role_equipe(role):
    return role in ROLES_EQUIPE
