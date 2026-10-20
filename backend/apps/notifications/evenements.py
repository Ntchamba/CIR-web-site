"""« Qui reçoit quoi » : textes des événements, liens et variables autorisées.

Les textes par défaut sont des messages traduits (`.po` des quatre langues). Un modèle enregistré par le
super-administrateur (`ModeleEmail`) les remplace pour l'e-mail (sujet et introduction seulement).
Les destinataires de chaque événement sont choisis dans `receivers.py`.

Variables autorisées dans les textes, entre accolades :
- `{nom}` : nom complet du client concerné ;
- `{reference}` : référence de la commande, de la demande, de la demande de contact ou de l'appel ;
- `{montant}` : montant en FCFA (vide quand l'événement n'en a pas) ;
- `{etape}` : étape de la commande, dans la langue du destinataire.
"""
from string import Formatter

from django.utils.translation import gettext_lazy as _

from apps.commandes.etapes import Etat

from .models import TypeNotification

VARIABLES = ("nom", "reference", "montant", "etape")
SUJET_MAX = 150
INTRODUCTION_MAX = 1000

T = TypeNotification

# événement → (sujet, introduction) par défaut
TEXTES = {
    T.COMMANDE_CREEE: (
        _("Votre commande {reference} est enregistrée"),
        _("Bonjour {nom}, nous avons bien reçu votre commande. L'équipe du CIR l'étudie et vous fera une "
          "proposition."),
    ),
    T.COMMANDE_NOUVELLE: (
        _("Nouvelle commande {reference}"),
        _("{nom} vient de passer la commande {reference}. Elle attend votre étude."),
    ),
    T.PROPOSITION_RECUE: (
        _("Du nouveau sur votre commande {reference}"),
        _("Bonjour {nom}, l'équipe du CIR a répondu dans la négociation de votre commande {reference}. "
          "Consultez la proposition et répondez-y."),
    ),
    T.PROPOSITION_CLIENT: (
        _("Réponse du client sur la commande {reference}"),
        _("{nom} a répondu dans la négociation de la commande {reference}."),
    ),
    T.CONTRAT_SIGNE: (
        _("Contrat signé : commande {reference}"),
        _("Le contrat de la commande {reference} de {nom} est signé. Montant convenu : {montant}."),
    ),
    T.ETAPE_CHANGEE: (
        _("Commande {reference} : {etape}"),
        _("Bonjour {nom}, l'étape de votre commande {reference} a changé : {etape}."),
    ),
    T.DEVIS_ENVOYE: (
        _("Votre devis pour la commande {reference}"),
        _("Bonjour {nom}, l'équipe du CIR vous a envoyé un devis pour la commande {reference} (total : {montant}). "
          "Vous pouvez le consulter et y répondre dans la négociation."),
    ),
    T.DEMANDE_RENDU_NOUVELLE: (
        _("Nouvelle demande de rendu {reference}"),
        _("{nom} a déposé la demande de rendu {reference}."),
    ),
    T.DEMANDE_RENDU_REPONDUE: (
        _("Réponse à votre demande de rendu {reference}"),
        _("Bonjour {nom}, l'équipe du CIR a répondu à votre demande de rendu {reference}."),
    ),
    T.CONTACT_NOUVEAU: (
        _("Nouvelle demande de contact {reference}"),
        _("{nom} a envoyé la demande de contact {reference}."),
    ),
    T.CONTACT_REPONDU: (
        _("Réponse à votre demande {reference}"),
        _("Bonjour {nom}, l'équipe du CIR a répondu à votre demande de contact {reference}."),
    ),
    T.MESSAGE_NOUVEAU: (
        _("Nouveau message dans la messagerie du CIR"),
        _("Des messages non lus vous attendent dans la messagerie du CIR (conversation avec {nom})."),
    ),
    T.APPEL_MANQUE: (
        _("Appel manqué de {nom}"),
        _("{nom} a essayé de joindre le CIR par un appel ({reference}) sans réponse. Pensez à le rappeler."),
    ),
    T.NOUVEAUTE: (
        _("Une nouveauté du CIR"),
        _("Bonjour {nom}, découvrez la dernière nouveauté du CIR."),
    ),
}
EVENEMENTS = tuple(TEXTES)


def variables_de(donnees):
    """Valeurs des variables autorisées pour un événement (texte brut, jamais du HTML)."""
    from .courriels import formater_montant

    etape = donnees.get("etape")
    return {
        "nom": str(donnees.get("nom") or ""),
        "reference": str(donnees.get("reference") or ""),
        "montant": "[montant]" if donnees.get("exemple") else formater_montant(donnees.get("montant")),
        "etape": str(Etat(etape).label) if etape in Etat.values else "",
    }


def verifier_texte(texte):
    """Variables d'un texte de modèle. Renvoie la liste des noms inconnus ; lève ValueError si les accolades sont mal formées.

    Seules les variables `{nom}`, `{reference}`, `{montant}` et `{etape}` sont permises : ni accès à un attribut, ni format.
    """
    inconnues = []
    for _litteral, champ, specification, conversion in Formatter().parse(texte):
        if champ is None:
            continue
        if champ not in VARIABLES or specification or conversion:
            inconnues.append(champ or "")
    return inconnues


def formater(texte, valeurs, secours):
    """Remplace les variables du texte ; en cas de problème, utilise le texte de secours (par défaut)."""
    try:
        return texte.format_map(valeurs)
    except (KeyError, ValueError, IndexError, AttributeError):
        return secours.format_map(valeurs)


def textes_par_defaut(evenement):
    """(sujet, introduction) par défaut dans la langue active."""
    sujet, introduction = TEXTES[evenement]
    return str(sujet), str(introduction)


def lien(evenement, donnees, equipe):
    """Chemin du site (client) ou du tableau de bord (équipe) ouvert par la notification."""
    commande = donnees.get("commande")
    if evenement in (T.COMMANDE_CREEE, T.COMMANDE_NOUVELLE, T.PROPOSITION_RECUE, T.PROPOSITION_CLIENT,
                     T.CONTRAT_SIGNE, T.ETAPE_CHANGEE, T.DEVIS_ENVOYE):
        return f"/commandes/{commande}" if commande else "/commandes"
    if evenement == T.DEMANDE_RENDU_NOUVELLE:
        return "/devis"
    if evenement in (T.DEMANDE_RENDU_REPONDUE, T.CONTACT_REPONDU):
        return "/mes-demandes"
    if evenement == T.CONTACT_NOUVEAU:
        return "/contact"
    if evenement == T.MESSAGE_NOUVEAU:
        return "/messagerie" if equipe else "/messages"
    if evenement == T.APPEL_MANQUE:
        return "/appels"
    if evenement == T.NOUVEAUTE:
        slug = donnees.get("slug")
        return f"/actualites/{slug}" if slug else "/actualites"
    return "/"
