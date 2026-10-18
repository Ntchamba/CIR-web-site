"""Contrat (BF-12) : récapitulatif en lecture seule d'une commande signée (pas de PDF dans cette vague).

Le contrat n'est pas un modèle : il se déduit de la commande, de la proposition acceptée et des lignes.
"""
from .etapes import CLIENT, EQUIPE
from .models import EtatProposition


def proposition_acceptee(commande):
    """Dernière proposition acceptée (propositions préchargées, sans requête en plus)."""
    acceptees = [p for p in commande.propositions.all() if p.etat == EtatProposition.ACCEPTEE]
    return acceptees[-1] if acceptees else None


def contrat_de(commande, lignes):
    """Objet `contrat` du détail d'une commande, ou None tant qu'elle n'est pas signée.

    `lignes` : lignes déjà mises en forme par le sérialiseur (même forme que dans le détail).
    """
    if commande.signe_le is None:
        return None
    proposition = proposition_acceptee(commande)
    accepte_par = None
    if proposition is not None:  # l'acceptation vient de l'autre partie que l'auteur de la proposition
        accepte_par = CLIENT if proposition.auteur_role == EQUIPE else EQUIPE
    client = commande.client
    return {
        "reference": commande.reference,
        "signe_le": commande.signe_le,
        "accepte_par": accepte_par,
        "client": {"nom_complet": client.nom_complet, "email": client.email, "telephone": client.telephone},
        "adresse": {"ville": commande.ville, "quartier": commande.quartier, "rue_ou_repere": commande.rue_ou_repere},
        "lignes": lignes,
        "montant": None if commande.montant_convenu is None else str(commande.montant_convenu),
        "prix_m2": None if commande.prix_m2_convenu is None else str(commande.prix_m2_convenu),
        "delai_jours": commande.delai_convenu_jours,
        "proposition": proposition.pk if proposition is not None else None,
    }
