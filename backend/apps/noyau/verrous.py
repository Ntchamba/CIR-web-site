"""Verrous de base de données partagés par les modules."""
from django.contrib.auth import get_user_model


def verrouiller_compte(utilisateur):
    """Bloque la ligne du compte jusqu'à la fin de la transaction en cours (à appeler dans `transaction.atomic`).

    Sert aux limites par jour : sans ce verrou, plusieurs envois du même compte, faits exactement en même temps,
    comptent tous « 0 envoi aujourd'hui » avant que l'un d'eux ne soit enregistré, et passent tous. Avec ce verrou,
    les envois d'un même compte passent l'un après l'autre. (SQLite ignore le verrou ; PostgreSQL le respecte.)
    """
    return get_user_model().objects.select_for_update().get(pk=utilisateur.pk)
