"""État du règlement d'une commande (calculé à partir de `montant_convenu` et `montant_paye`).

`commandes` ne connaît pas le module `paiements` : celui-ci est le seul à modifier `montant_paye`.
"""
from .etapes import Etat

# Étapes où un paiement est permis (après « Contrat signé », jamais avant ni après une annulation)
ETATS_PAIEMENT = (Etat.CONTRAT_SIGNE, Etat.TRAVAUX, Etat.TERMINEE)

NON_APPLICABLE = "non_applicable"
NON_PAYE = "non_paye"
PARTIEL = "partiel"
PAYE = "paye"
STATUTS = (NON_PAYE, PARTIEL, PAYE)


def paiement_applicable(commande):
    return commande.etat in ETATS_PAIEMENT and commande.montant_convenu is not None


def reste_a_payer(commande):
    """Reste à payer en FCFA (jamais négatif) ; None sans montant convenu."""
    if commande.montant_convenu is None:
        return None
    return max(0, commande.montant_convenu - (commande.montant_paye or 0))


def statut_paiement(commande):
    if not paiement_applicable(commande):
        return NON_APPLICABLE
    paye = commande.montant_paye or 0
    if paye >= commande.montant_convenu:
        return PAYE
    return PARTIEL if paye > 0 else NON_PAYE
