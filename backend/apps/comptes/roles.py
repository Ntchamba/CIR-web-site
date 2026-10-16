"""Rôles des comptes : client (site public), membre et super-administrateur (équipe du CIR)."""
from django.db import models


class Role(models.TextChoices):
    CLIENT = "client", "Client"
    MEMBRE = "membre", "Membre de l'équipe"
    SUPER_ADMIN = "super_admin", "Super-administrateur"


ROLES_EQUIPE = (Role.MEMBRE, Role.SUPER_ADMIN)


def est_role_equipe(role):
    return role in ROLES_EQUIPE
