"""Adresse du client : ville, quartier, rue ou repère (obligatoire pour commander, BF-08 / BNF-01)."""
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

CHAMPS_ADRESSE = ("ville", "quartier", "rue_ou_repere")
# Messages complets (et non « {libellé} est obligatoire ») : l'accord se fait différemment selon la langue.
MESSAGES_MANQUANT = {
    "ville": _("La ville est obligatoire."),
    "quartier": _("Le quartier est obligatoire."),
    "rue_ou_repere": _("La rue ou un repère est obligatoire."),
}


def nettoyer(valeur):
    return " ".join(str(valeur or "").split())


def adresse_est_complete(ville, quartier, rue_ou_repere):
    return all(nettoyer(v) for v in (ville, quartier, rue_ou_repere))


def valider_adresse(donnees, partielle=False):
    """Nettoie les champs d'adresse fournis et refuse les champs vides.

    `partielle=True` (modification du profil) : seuls les champs présents sont contrôlés.
    Renvoie un dictionnaire ne contenant que les champs d'adresse nettoyés.
    """
    propres, erreurs = {}, {}
    for champ in CHAMPS_ADRESSE:
        if partielle and champ not in donnees:
            continue
        valeur = nettoyer(donnees.get(champ))
        if not valeur:
            erreurs[champ] = [MESSAGES_MANQUANT[champ]]
        propres[champ] = valeur
    if erreurs:
        raise ValidationError(erreurs)
    return propres
