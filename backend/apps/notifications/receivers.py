"""Abonnés aux signaux des autres modules : « qui reçoit quoi ».

Les autres modules n'importent jamais `notifications` : ils émettent des signaux (`apps/<module>/signals.py`) auxquels
ce fichier s'abonne (voir `apps.py`). Une panne de notification ne fait jamais échouer l'action d'origine : l'erreur
est journalisée et la partie de transaction concernée (un point de sauvegarde) est annulée.
"""
import logging
import uuid
from functools import wraps

from django.db import transaction
from django.dispatch import receiver
from django.utils import timezone

from apps.actualites.signals import actualite_publiee
from apps.appels.signals import appel_manque
from apps.commandes.etapes import Etat
from apps.commandes.signals import (commande_creee, etape_changee, proposition_creee, proposition_refusee)
from apps.contact.signals import demande_contact_creee, demande_contact_repondue
from apps.devis.signals import demande_rendu_creee, demande_rendu_repondue, devis_envoye
from apps.messagerie.signals import message_cree, messages_lus

from . import services
from .models import TypeNotification as T

journal = logging.getLogger("cir.notifications")


def securise(fonction):
    """Une panne de notification n'annule ni ne bloque l'action d'origine."""

    @wraps(fonction)
    def enveloppe(sender, **kwargs):
        try:
            with transaction.atomic():
                fonction(sender, **kwargs)
        except Exception:  # noqa: BLE001
            journal.exception("Notification impossible (%s).", fonction.__name__)

    return enveloppe


def _unique():
    return uuid.uuid4().hex[:10]


def _donnees_commande(commande, **plus):
    return {"commande": commande.pk, "reference": commande.reference, "nom": commande.client.nom_complet, **plus}


# --- Commandes ---

@receiver(commande_creee)
@securise
def sur_commande_creee(sender, commande, **kwargs):
    donnees = _donnees_commande(commande)
    services.notifier(commande.client, T.COMMANDE_CREEE, donnees,
                      cle_unique=f"commande_creee:{commande.pk}:{commande.client_id}")
    for membre in services.membres_equipe():
        services.notifier(membre, T.COMMANDE_NOUVELLE, donnees, cle_unique=f"commande_nouvelle:{commande.pk}:{membre.pk}")


@receiver(etape_changee)
@securise
def sur_etape_changee(sender, commande, de, vers, auteur, **kwargs):
    client = commande.client
    if vers == Etat.CONTRAT_SIGNE:
        donnees = _donnees_commande(commande, montant=commande.montant_convenu)
        services.notifier(client, T.CONTRAT_SIGNE, donnees, cle_unique=f"contrat_signe:{commande.pk}:{client.pk}")
        for membre in services.membres_equipe():
            services.notifier(membre, T.CONTRAT_SIGNE, donnees,
                              cle_unique=f"contrat_signe:{commande.pk}:{membre.pk}")
    elif vers in (Etat.TRAVAUX, Etat.TERMINEE, Etat.ANNULEE):
        if auteur is not None and auteur.pk == client.pk:  # le client connaît sa propre action
            return
        services.notifier(client, T.ETAPE_CHANGEE, _donnees_commande(commande, etape=vers),
                          cle_unique=f"etape_changee:{commande.pk}:{vers}:{client.pk}")


def _proposition_vers_client(proposition, motif):
    commande = proposition.commande
    services.notifier(commande.client, T.PROPOSITION_RECUE, _donnees_commande(commande),
                      cle_unique=f"proposition_recue:{motif}:{proposition.pk}:{commande.client_id}")


def _proposition_vers_equipe(proposition, motif):
    commande = proposition.commande
    donnees = _donnees_commande(commande)
    for membre in services.membres_equipe():
        services.notifier(membre, T.PROPOSITION_CLIENT, donnees,
                          cle_unique=f"proposition_client:{motif}:{proposition.pk}:{membre.pk}")


@receiver(proposition_creee)
@securise
def sur_proposition_creee(sender, proposition, **kwargs):
    if proposition.devis_id:  # un devis envoyé a sa propre notification
        return
    if proposition.auteur_role == "equipe":
        _proposition_vers_client(proposition, "creee")
    else:
        _proposition_vers_equipe(proposition, "creee")


@receiver(proposition_refusee)
@securise
def sur_proposition_refusee(sender, proposition, **kwargs):
    if proposition.commande.etat == Etat.ANNULEE:  # annulation : l'étape a déjà sa notification
        return
    if proposition.auteur_role == "equipe":  # refusée par le client
        _proposition_vers_equipe(proposition, "refusee")
    else:
        _proposition_vers_client(proposition, "refusee")


# --- Devis ---

@receiver(devis_envoye)
@securise
def sur_devis_envoye(sender, devis, **kwargs):
    commande = devis.commande
    donnees = _donnees_commande(commande, montant=devis.total)
    services.notifier(commande.client, T.DEVIS_ENVOYE, donnees, cle_unique=f"devis_envoye:{devis.pk}:{commande.client_id}")


@receiver(demande_rendu_creee)
@securise
def sur_demande_rendu_creee(sender, demande, **kwargs):
    donnees = {"demande": demande.pk, "reference": demande.reference, "nom": demande.client.nom_complet}
    for membre in services.membres_equipe():
        services.notifier(membre, T.DEMANDE_RENDU_NOUVELLE, donnees,
                          cle_unique=f"demande_rendu_nouvelle:{demande.pk}:{membre.pk}")


@receiver(demande_rendu_repondue)
@securise
def sur_demande_rendu_repondue(sender, demande, **kwargs):
    donnees = {"demande": demande.pk, "reference": demande.reference, "nom": demande.client.nom_complet}
    services.notifier(demande.client, T.DEMANDE_RENDU_REPONDUE, donnees,
                      cle_unique=f"demande_rendu_repondue:{demande.pk}:{_unique()}")


# --- Contact ---

@receiver(demande_contact_creee)
@securise
def sur_contact_cree(sender, demande, **kwargs):
    donnees = {"demande": demande.pk, "reference": demande.reference, "nom": demande.nom}
    for membre in services.membres_equipe():
        services.notifier(membre, T.CONTACT_NOUVEAU, donnees, cle_unique=f"contact_nouveau:{demande.pk}:{membre.pk}")


@receiver(demande_contact_repondue)
@securise
def sur_contact_repondu(sender, demande, **kwargs):
    auteur = demande.auteur
    if auteur is None or not auteur.is_active:  # un visiteur sans compte n'a ni centre de notifications ni e-mail
        return
    donnees = {"demande": demande.pk, "reference": demande.reference, "nom": auteur.nom_complet}
    services.notifier(auteur, T.CONTACT_REPONDU, donnees, cle_unique=f"contact_repondu:{demande.pk}:{_unique()}")


# --- Messagerie ---

@receiver(message_cree)
@securise
def sur_message_cree(sender, message, **kwargs):
    conversation = message.conversation
    donnees = {"conversation": conversation.pk, "nom": conversation.client.nom_complet}
    if message.auteur_role == "client":
        for membre in services.membres_equipe():
            services.notifier_message(membre, donnees)
    elif conversation.client.is_active:
        services.notifier_message(conversation.client, donnees)


@receiver(messages_lus)
@securise
def sur_messages_lus(sender, conversation, role_lecteur, **kwargs):
    if role_lecteur == "client":  # le client a lu les messages de l'équipe : ses notifications disparaissent
        services.marquer_messages_lus(conversation.pk, [conversation.client])
    else:  # un membre de l'équipe a lu : la boîte est partagée, tous les membres sont à jour
        services.marquer_messages_lus(conversation.pk, services.membres_equipe())


# --- Appels ---

@receiver(appel_manque)
@securise
def sur_appel_manque(sender, appel, **kwargs):
    donnees = {"appel": appel.pk, "reference": appel.reference, "nom": appel.client.nom_complet}
    for membre in services.membres_equipe():
        services.notifier(membre, T.APPEL_MANQUE, donnees, cle_unique=f"appel_manque:{appel.pk}:{membre.pk}")


# --- Nouveautés (BF-07) ---

@receiver(actualite_publiee)
@securise
def sur_actualite_publiee(sender, actualite, **kwargs):
    services.diffuser_nouveaute(actualite)
