"""Négociation (BF-12) : propositions, contre-propositions, révisions, acceptation et refus.

Règles (contrat de la vague 2, règle 4) :
- une seule proposition « en attente » à la fois ; une nouvelle proposition remplace l'ancienne (contre-proposition
  si elle vient de l'autre partie, révision si elle vient de la même) ;
- accepter ou refuser : seulement par l'autre partie que l'auteur ; accepter passe la commande en « Contrat signé »
  et fixe montant, prix au m² et délai convenus.
Tous les services verrouillent la commande (`select_for_update`) : deux réponses simultanées ne passent pas.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from . import signals
from .etapes import ETATS_NEGOCIABLES, Etat, changer_etat
from .models import Commande, EtatProposition, Proposition

MESSAGE_MAX = 1000
TOLERANCE_TOTAL = 1  # FCFA d'écart accepté entre le total saisi et prix au m² × surface


def calculer_total(prix_m2, surface_m2):
    """Total = prix au m² × surface, arrondi à l'entier le plus proche (demi vers le haut). None si inconnu."""
    if prix_m2 is None or surface_m2 is None:
        return None
    return int((Decimal(prix_m2) * Decimal(surface_m2)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _entier(valeur, champ, minimum=0):
    if valeur is None:
        return None
    if isinstance(valeur, bool) or not isinstance(valeur, int) or valeur < minimum:
        raise ValidationError({champ: [_("Indiquez un nombre entier supérieur ou égal à %(minimum)s.")
                                       % {"minimum": minimum}]})
    return valeur


def preparer_proposition(surface_m2, *, prix_m2=None, total=None, delai_jours=None, message=""):
    """Contrôle les montants d'une proposition et complète le total quand la surface est connue."""
    prix_m2 = _entier(prix_m2, "prix_m2")
    total = _entier(total, "total")
    delai_jours = _entier(delai_jours, "delai_jours", minimum=1)
    message = (message or "").strip()
    if len(message) > MESSAGE_MAX:
        raise ValidationError({"message": [_("Le message est trop long (%(max)s caractères au plus).")
                                           % {"max": MESSAGE_MAX}]})
    if prix_m2 is None and total is None:
        raise ValidationError({"detail": _("Indiquez au moins un prix au m² ou un total.")})
    calcule = calculer_total(prix_m2, surface_m2)
    if total is None:
        total = calcule
    elif calcule is not None and abs(total - calcule) > TOLERANCE_TOTAL:
        raise ValidationError({"total": [_("Le total ne correspond pas au prix au m² multiplié par la surface "
                                           "(%(attendu)s FCFA).") % {"attendu": calcule}]})
    return {"prix_m2": prix_m2, "total": total, "delai_jours": delai_jours, "message": message}


def verrouiller(commande):
    """Relit la commande en la verrouillant (dans la transaction en cours)."""
    return Commande.objects.select_for_update().get(pk=commande.pk)


def _cloturer(proposition, etat, signal):
    proposition.etat = etat
    proposition.repondu_le = timezone.now()
    proposition.save(update_fields=["etat", "repondu_le", "reponse"])
    signal.send(sender=Proposition, proposition=proposition)


def remplacer_en_attente(commande):
    """L'éventuelle proposition en attente passe à « remplacée »."""
    for ancienne in commande.propositions.filter(etat=EtatProposition.EN_ATTENTE):
        _cloturer(ancienne, EtatProposition.REMPLACEE, signals.proposition_remplacee)


def refuser_en_attente(commande):
    """À l'annulation de la commande, la proposition restée en attente est refusée (le devis lié suit)."""
    for ancienne in commande.propositions.filter(etat=EtatProposition.EN_ATTENTE):
        _cloturer(ancienne, EtatProposition.REFUSEE, signals.proposition_refusee)


@transaction.atomic
def proposer(commande, auteur, role, donnees, devis=None):
    """Crée une proposition de `role` (« client » ou « equipe »). Première proposition : « En négociation »."""
    commande = verrouiller(commande)
    if commande.etat not in ETATS_NEGOCIABLES:
        raise ValidationError({"detail": _("Cette commande n'est plus en négociation : aucune proposition "
                                           "n'est possible.")})
    propres = preparer_proposition(commande.surface_m2, **donnees)
    remplacer_en_attente(commande)
    proposition = Proposition.objects.create(commande=commande, auteur=auteur, auteur_role=role, devis=devis,
                                             **propres)
    if commande.etat == Etat.NOUVELLE:
        changer_etat(commande, Etat.NEGOCIATION, role=role, auteur=auteur, interne=True)
    else:
        commande.save(update_fields=["modifie_le"])
    return proposition


def _controler_reponse(proposition, commande, role):
    if proposition.etat != EtatProposition.EN_ATTENTE or commande.etat != Etat.NEGOCIATION:
        raise ValidationError({"detail": _("Cette proposition n'attend plus de réponse.")})
    if role == proposition.auteur_role:
        raise ValidationError({"detail": _("Vous ne pouvez pas répondre à votre propre proposition.")})


def _message_reponse(message):
    message = (message or "").strip()
    if len(message) > MESSAGE_MAX:
        raise ValidationError({"message": [_("Le message est trop long (%(max)s caractères au plus).")
                                           % {"max": MESSAGE_MAX}]})
    return message


def montant_de(proposition, surface_m2):
    """Montant que fixera l'acceptation : le total, sinon prix au m² × surface ; None si indéterminable."""
    if proposition.total is not None:
        return proposition.total
    return calculer_total(proposition.prix_m2, surface_m2)


@transaction.atomic
def accepter(proposition, auteur, role, message=""):
    """L'autre partie accepte : la commande passe à « Contrat signé » et fixe les conditions convenues."""
    commande = verrouiller(proposition.commande)
    proposition = Proposition.objects.select_for_update().get(pk=proposition.pk)
    _controler_reponse(proposition, commande, role)
    message = _message_reponse(message)
    montant = montant_de(proposition, commande.surface_m2)
    if montant is None:
        raise ValidationError({"detail": _("Impossible de déterminer le montant : précisez la surface de la "
                                           "commande.")})
    commande.montant_convenu = montant
    commande.prix_m2_convenu = proposition.prix_m2
    commande.delai_convenu_jours = proposition.delai_jours
    commande.signe_le = timezone.now()
    commande.save(update_fields=["montant_convenu", "prix_m2_convenu", "delai_convenu_jours", "signe_le"])
    changer_etat(commande, Etat.CONTRAT_SIGNE, role=role, auteur=auteur, motif=message, interne=True)
    proposition.reponse = message
    _cloturer(proposition, EtatProposition.ACCEPTEE, signals.proposition_acceptee)
    return proposition


@transaction.atomic
def refuser(proposition, auteur, role, message=""):
    """L'autre partie refuse : la commande reste en négociation."""
    commande = verrouiller(proposition.commande)
    proposition = Proposition.objects.select_for_update().get(pk=proposition.pk)
    _controler_reponse(proposition, commande, role)
    proposition.reponse = _message_reponse(message)
    commande.save(update_fields=["modifie_le"])
    _cloturer(proposition, EtatProposition.REFUSEE, signals.proposition_refusee)
    return proposition
