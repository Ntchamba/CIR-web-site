"""Permissions des statistiques : API réservée à l'équipe (les sommes d'argent, au super-administrateur)."""
from apps.noyau.permissions import EstEquipe, EstSuperAdmin  # noqa: F401 (réexport pour le module)
