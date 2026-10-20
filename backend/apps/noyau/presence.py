"""Présence en ligne (messagerie, appels, e-mails différés).

Chaque trame `ping` du WebSocket (toutes les 25 secondes) renouvelle un témoin dans le cache, valable 90 secondes.
Cache en mémoire en développement ; Redis en production (partagé entre les processus). Plusieurs onglets ouverts par
la même personne sont normaux : le témoin est unique par utilisateur.
"""
from django.core.cache import cache
from django.contrib.auth import get_user_model

TTL_SECONDES = 90


def _cle(utilisateur_id):
    return f"presence:utilisateur:{utilisateur_id}"


def marquer_en_ligne(utilisateur):
    """Renouvelle le témoin de présence de l'utilisateur (objet ou identifiant)."""
    cache.set(_cle(getattr(utilisateur, "pk", utilisateur)), 1, TTL_SECONDES)


def est_en_ligne(utilisateur):
    return bool(cache.get(_cle(getattr(utilisateur, "pk", utilisateur))))


def equipe_en_ligne():
    """Nombre de membres actifs de l'équipe en ligne."""
    ids = list(get_user_model().objects.equipe().filter(is_active=True).values_list("pk", flat=True))
    if not ids:
        return 0
    return len(cache.get_many([_cle(i) for i in ids]))
