"""Envoi différé des e-mails (file `EnvoiEmail`) et tâches périodiques.

Programme d'envoi : `python manage.py envoyer_emails` (une passe) ou `--boucle` (toutes les 20 secondes) ; c'est le
démarrage d'un second service Railway (« worker »). Règles :
- reprises après une erreur temporaire : 1 min, 5 min, 30 min, 3 h, puis « échec » (5 tentatives) ; erreur définitive :
  « échec » tout de suite ;
- plafond journalier `GMAIL_LIMITE_JOUR` (400 par défaut) : au-delà, les envois restants attendent le lendemain ;
- verrou de ligne (`select_for_update(skip_locked=True)`) : deux processus n'envoient jamais le même e-mail ;
- Gmail non configuré : les lignes restent « en attente » sans compter de tentative ; en développement (`DEBUG`),
  l'e-mail est écrit dans la console à la place ;
- destinataire sans adresse valide ou compte désactivé : « annulé ».
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError as ErreurDjango
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from integrations.gmail import client as gmail
from integrations.gmail.erreurs import GmailErreurDefinitive, GmailErreurTemporaire, GmailNonConfigure

from apps.actualites.models import Actualite
from apps.actualites.signals import actualite_publiee
from apps.messagerie.models import Message
from apps.noyau import presence

from . import services
from .models import EnvoiEmail, EtatEnvoi, TypeNotification

journal = logging.getLogger("cir.notifications")

TENTATIVES_MAX = 5
DELAIS_REPRISE = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30), timedelta(hours=3))
ATTENTE_MESSAGE = timedelta(minutes=10)  # message non lu avant l'e-mail
INTERVALLE_MESSAGES = timedelta(hours=1)  # au plus un e-mail par conversation et par heure
LOT_PAR_PASSE = 100


def _debut_du_jour():
    return timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)


def envoyes_aujourdhui():
    return EnvoiEmail.objects.filter(etat=EtatEnvoi.ENVOYE, envoye_le__gte=_debut_du_jour()).count()


def plafond_atteint():
    return envoyes_aujourdhui() >= settings.GMAIL_LIMITE_JOUR


def _adresse_valide(adresse):
    try:
        validate_email(adresse)
    except ErreurDjango:
        return False
    return "\r" not in adresse and "\n" not in adresse


def _erreur_courte(erreur):
    return str(erreur)[:300]


def _afficher_en_console(envoi):
    """Développement sans Gmail : l'e-mail s'affiche dans la console."""
    journal.warning("E-mail (console) à %s — %s\n%s", envoi.destinataire_email, envoi.sujet, envoi.corps_texte)


def traiter(pk):
    """Tente l'envoi d'une ligne de la file. Renvoie son état final, ou None si elle n'était pas à envoyer."""
    with transaction.atomic():
        envoi = (EnvoiEmail.objects.select_for_update(skip_locked=True)
                 .select_related("utilisateur")
                 .filter(pk=pk, etat=EtatEnvoi.EN_ATTENTE, prochaine_tentative__lte=timezone.now()).first())
        if envoi is None:  # déjà traitée, ou verrouillée par un autre processus
            return None
        utilisateur = envoi.utilisateur
        if (utilisateur is not None and not utilisateur.is_active) or not _adresse_valide(envoi.destinataire_email):
            envoi.etat = EtatEnvoi.ANNULE
            envoi.derniere_erreur = "Destinataire sans adresse valide ou compte désactivé."
            envoi.save(update_fields=["etat", "derniere_erreur"])
            return envoi.etat
        if not gmail.configure():
            if settings.DEBUG:
                _afficher_en_console(envoi)
                envoi.etat, envoi.envoye_le, envoi.message_id = EtatEnvoi.ENVOYE, timezone.now(), "console"
                envoi.save(update_fields=["etat", "envoye_le", "message_id"])
                return envoi.etat
            return EtatEnvoi.EN_ATTENTE  # rien n'est perdu, aucune tentative comptée
        if plafond_atteint():  # le reste attend le lendemain
            return EtatEnvoi.EN_ATTENTE
        message = gmail.MessageEmail(destinataire=envoi.destinataire_email, sujet=envoi.sujet,
                                     texte=envoi.corps_texte, html=envoi.corps_html, entetes=envoi.entetes or {})
        try:
            envoi.message_id = gmail.envoyer(message)
        except GmailNonConfigure:
            return EtatEnvoi.EN_ATTENTE
        except GmailErreurDefinitive as erreur:
            envoi.etat, envoi.derniere_erreur = EtatEnvoi.ECHEC, _erreur_courte(erreur)
            envoi.tentatives += 1
        except GmailErreurTemporaire as erreur:
            _reprendre_plus_tard(envoi, _erreur_courte(erreur))
        except Exception as erreur:  # noqa: BLE001 - imprévu : traité comme une erreur temporaire, sans détail sensible
            journal.exception("Envoi d'e-mail %s : erreur inattendue.", pk)
            _reprendre_plus_tard(envoi, f"Erreur inattendue ({type(erreur).__name__}).")
        else:
            envoi.etat, envoi.envoye_le, envoi.derniere_erreur = EtatEnvoi.ENVOYE, timezone.now(), ""
        envoi.save(update_fields=["etat", "envoye_le", "message_id", "tentatives", "prochaine_tentative",
                                  "derniere_erreur"])
        return envoi.etat


def _reprendre_plus_tard(envoi, erreur):
    envoi.tentatives += 1
    envoi.derniere_erreur = erreur
    if envoi.tentatives >= TENTATIVES_MAX:
        envoi.etat = EtatEnvoi.ECHEC
    else:
        envoi.prochaine_tentative = timezone.now() + DELAIS_REPRISE[envoi.tentatives - 1]


def traiter_sans_erreur(pk):
    """Envoi immédiat après la transaction : une panne est journalisée, la ligne reste dans la file."""
    try:
        return traiter(pk)
    except Exception:  # noqa: BLE001
        journal.exception("Envoi immédiat de l'e-mail %s impossible.", pk)
        return None


def envoyer_en_attente(limite=LOT_PAR_PASSE):
    """Une passe du programme d'envoi. Renvoie le nombre d'e-mails envoyés."""
    envoyes = 0
    if plafond_atteint():
        return 0
    ids = EnvoiEmail.objects.filter(etat=EtatEnvoi.EN_ATTENTE, prochaine_tentative__lte=timezone.now()) \
        .order_by("id").values_list("pk", flat=True)[:limite]
    for pk in list(ids):
        if plafond_atteint():
            break
        if traiter_sans_erreur(pk) == EtatEnvoi.ENVOYE:
            envoyes += 1
    return envoyes


# --- E-mails des messages (différés) ---

def preparer_emails_messages(maintenant=None):
    """Ajoute à la file les e-mails des messages restés non lus 10 minutes (destinataire hors ligne).

    Au plus un e-mail par conversation, par destinataire et par heure ; un message lu entre-temps n'envoie rien.
    Renvoie le nombre d'e-mails ajoutés.
    """
    maintenant = maintenant or timezone.now()
    en_retard = (Message.objects.filter(lu_le__isnull=True, cree_le__lte=maintenant - ATTENTE_MESSAGE)
                 .select_related("conversation__client"))
    groupes = {}
    for message in en_retard.order_by("id"):
        cle = (message.conversation_id, message.auteur_role)
        groupes.setdefault(cle, []).append(message)
    ajoutes = 0
    for (conversation_id, role), messages in groupes.items():
        conversation = messages[0].conversation
        dernier_id = messages[-1].pk
        destinataires = [conversation.client] if role == "equipe" else services.membres_equipe()
        for destinataire in destinataires:
            if presence.est_en_ligne(destinataire.pk) or not services.peut_recevoir_email(
                    destinataire, TypeNotification.MESSAGE_NOUVEAU):
                continue
            prefixe = f"message_nouveau:{conversation_id}:{destinataire.pk}:"
            derniere = (EnvoiEmail.objects.filter(cle_unique__startswith=prefixe)
                        .exclude(etat=EtatEnvoi.ANNULE).order_by("-id").first())
            if derniere is not None:
                if derniere.cree_le > maintenant - INTERVALLE_MESSAGES:
                    continue
                if dernier_id <= int(derniere.cle_unique.rsplit(":", 1)[1]):
                    continue
            donnees = {"conversation": conversation_id, "nom": conversation.client.nom_complet}
            try:
                with transaction.atomic():
                    if services.mettre_en_file(destinataire, TypeNotification.MESSAGE_NOUVEAU, donnees,
                                               f"{prefixe}{dernier_id}") is not None:
                        ajoutes += 1
            except Exception:  # noqa: BLE001
                journal.exception("E-mail de message impossible pour la conversation %s.", conversation_id)
    return ajoutes


# --- Nouveautés (BF-07) ---

def notifier_actualites():
    """Annonce **une seule fois** chaque actualité devenue visible. Renvoie le nombre d'actualités annoncées."""
    maintenant = timezone.now()
    candidates = Actualite.objects.filter(publie=True, publie_le__lte=maintenant, notifiee_le__isnull=True)
    annoncees = 0
    for pk in list(candidates.order_by("publie_le", "pk").values_list("pk", flat=True)):
        with transaction.atomic():
            actualite = (Actualite.objects.select_for_update(skip_locked=True)
                         .filter(pk=pk, publie=True, publie_le__lte=maintenant, notifiee_le__isnull=True).first())
            if actualite is None:  # annoncée entre-temps par un autre processus
                continue
            actualite_publiee.send(sender=Actualite, actualite=actualite)
            Actualite.objects.filter(pk=pk).update(notifiee_le=timezone.now())
            annoncees += 1
    return annoncees
