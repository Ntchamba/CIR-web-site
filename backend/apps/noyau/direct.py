"""Publication en direct (WebSocket) pour les autres modules.

Les modules ne parlent jamais directement à Channels : ils appellent `publier_utilisateur` et `publier_equipe`.
- Appelables depuis du code synchrone, sans bloquer.
- La publication part **après la validation de la transaction** en cours (`transaction.on_commit`) : le destinataire
  qui recharge la page voit déjà le changement.
- Une panne du canal ne fait jamais échouer l'action d'origine : elle est journalisée.

Les compteurs (`non_lus`) viennent des modules qui s'enregistrent avec `enregistrer_compteur` (messagerie,
notifications) : aucun module n'importe l'autre.
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

journal = logging.getLogger("cir.direct")

GROUPE_EQUIPE = "equipe"
_compteurs = {}


def groupe_utilisateur(utilisateur_id):
    return f"utilisateur_{utilisateur_id}"


def _envoyer(groupe, type_trame, donnees):
    try:
        couche = get_channel_layer()
        if couche is None:
            return
        trame = {"type": type_trame, **donnees}
        async_to_sync(couche.group_send)(groupe, {"type": "direct.evenement", "trame": trame})
    except Exception:  # noqa: BLE001 - une panne du canal ne doit jamais faire échouer l'action d'origine
        journal.exception("Publication en direct impossible (groupe %s, type %s).", groupe, type_trame)


def _apres_validation(fonction):
    try:
        transaction.on_commit(fonction)
    except Exception:  # noqa: BLE001
        journal.exception("Publication en direct impossible.")


def publier_utilisateur(utilisateur_id, type, donnees):
    """Envoie une trame `{"type": type, **donnees}` à toutes les connexions de l'utilisateur."""
    _apres_validation(lambda: _envoyer(groupe_utilisateur(utilisateur_id), type, donnees))


def publier_equipe(type, donnees):
    """Envoie une trame à toutes les connexions des membres de l'équipe."""
    _apres_validation(lambda: _envoyer(GROUPE_EQUIPE, type, donnees))


# --- Compteurs de pastilles ---

def enregistrer_compteur(nom, fonction):
    """`fonction(utilisateur) -> int` : nombre d'éléments non lus de l'utilisateur pour `nom`."""
    _compteurs[nom] = fonction


def compteurs(utilisateur):
    """{"messagerie": n, "notifications": n} : une panne d'un compteur donne 0 sans bloquer."""
    resultat = {}
    for nom in ("messagerie", "notifications"):
        try:
            resultat[nom] = int(_compteurs[nom](utilisateur)) if nom in _compteurs else 0
        except Exception:  # noqa: BLE001
            journal.exception("Compteur « %s » indisponible.", nom)
            resultat[nom] = 0
    return resultat


def publier_compteurs(utilisateur):
    """Pousse `{"type": "non_lus", "messagerie": n, "notifications": n}` à l'utilisateur."""
    try:
        valeurs = compteurs(utilisateur)
    except Exception:  # noqa: BLE001
        journal.exception("Compteurs indisponibles.")
        return
    publier_utilisateur(utilisateur.pk, "non_lus", valeurs)
