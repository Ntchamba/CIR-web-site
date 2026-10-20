"""Machine à états de la commande (BF-10) : Nouvelle → En négociation → Contrat signé → Travaux en cours →
Terminée, plus Annulée.

Le tableau `TRANSITIONS` fait foi (règle 3 du contrat) : pour chaque passage, qui peut le déclencher et si
le passage est « interne » (il découle d'une action de négociation et ne se pose jamais à la main).
"""
from collections import namedtuple

from django.db import models, transaction
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError

from . import signals


class Etat(models.TextChoices):
    NOUVELLE = "nouvelle", gettext_lazy("Nouvelle")
    NEGOCIATION = "negociation", gettext_lazy("En négociation")
    CONTRAT_SIGNE = "contrat_signe", gettext_lazy("Contrat signé")
    TRAVAUX = "travaux", gettext_lazy("Travaux en cours")
    TERMINEE = "terminee", gettext_lazy("Terminée")
    ANNULEE = "annulee", gettext_lazy("Annulée")


class Role(models.TextChoices):
    """Partie qui agit : le client ou l'équipe du CIR."""

    CLIENT = "client", gettext_lazy("Client")
    EQUIPE = "equipe", gettext_lazy("Équipe")


Regle = namedtuple("Regle", "roles interne")

CLIENT, EQUIPE = Role.CLIENT.value, Role.EQUIPE.value
TOUS = frozenset({CLIENT, EQUIPE})

TRANSITIONS = {
    # automatique, à la première proposition (client ou équipe)
    (Etat.NOUVELLE, Etat.NEGOCIATION): Regle(TOUS, True),
    (Etat.NOUVELLE, Etat.ANNULEE): Regle(TOUS, False),
    (Etat.NEGOCIATION, Etat.ANNULEE): Regle(TOUS, False),
    # uniquement en acceptant une proposition
    (Etat.NEGOCIATION, Etat.CONTRAT_SIGNE): Regle(TOUS, True),
    (Etat.CONTRAT_SIGNE, Etat.TRAVAUX): Regle(frozenset({EQUIPE}), False),
    (Etat.CONTRAT_SIGNE, Etat.ANNULEE): Regle(frozenset({EQUIPE}), False),
    (Etat.TRAVAUX, Etat.TERMINEE): Regle(frozenset({EQUIPE}), False),
}

ETATS_DEFINITIFS = (Etat.TERMINEE, Etat.ANNULEE)
# Étapes où l'on peut encore négocier (proposer, accepter, refuser)
ETATS_NEGOCIABLES = (Etat.NOUVELLE, Etat.NEGOCIATION)


def transition_permise(de, vers, role, interne=False):
    """Vrai si `role` peut faire passer une commande de `de` à `vers` (`interne` : appel de la négociation)."""
    regle = TRANSITIONS.get((de, vers))
    if regle is None or role not in regle.roles:
        return False
    return interne or not regle.interne


def actions_possibles(etat, role):
    """Actions offertes à `role` sur une commande dans l'état `etat` (le front ne recalcule rien)."""
    if role == CLIENT:
        if etat == Etat.NOUVELLE:
            return ["modifier", "annuler", "proposer"]
        if etat == Etat.NEGOCIATION:
            return ["annuler", "proposer"]
        return []
    if etat in ETATS_NEGOCIABLES:
        return ["modifier", "annuler", "proposer"]
    if etat == Etat.CONTRAT_SIGNE:
        return ["annuler", "demarrer_travaux"]
    if etat == Etat.TRAVAUX:
        return ["terminer"]
    return []


@transaction.atomic
def changer_etat(commande, vers, *, role, auteur=None, motif="", interne=False):
    """Fait passer la commande à l'étape `vers` et écrit la ligne d'historique. Refuse toute autre transition.

    `role` : « client » ou « equipe » (la partie qui agit) ; `interne=True` réservé aux services de négociation.
    """
    from .models import ChangementEtat

    de = commande.etat
    if not transition_permise(de, vers, role, interne):
        raise ValidationError({"detail": _("Cette commande ne peut pas passer de l'étape « %(de)s » à l'étape "
                                           "« %(vers)s ».") % {"de": Etat(de).label, "vers": Etat(vers).label}})
    commande.etat = vers
    commande.save(update_fields=["etat", "modifie_le"])
    ChangementEtat.objects.create(commande=commande, de=de, vers=vers, auteur=auteur, auteur_role=role,
                                  motif=(motif or "").strip()[:500])
    signals.etape_changee.send(sender=type(commande), commande=commande, de=de, vers=vers, auteur=auteur)
    return commande
