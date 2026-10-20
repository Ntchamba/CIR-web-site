"""Statistiques : les calculs sont dans `indicateurs.py` ; ce module décide de ce que chaque rôle peut voir."""
from . import indicateurs


def resume(utilisateur, du=None, au=None):
    """Résumé de la période ; les sommes d'argent ne sont données qu'au super-administrateur."""
    debut, fin = indicateurs.resoudre_periode(du, au)
    return indicateurs.resume(debut, fin, avec_montants=bool(getattr(utilisateur, "est_super_admin", False)))


def evolution(utilisateur, mois=None):
    nombre = indicateurs.resoudre_mois(mois)
    return indicateurs.evolution(nombre, avec_montants=bool(getattr(utilisateur, "est_super_admin", False)))
