"""Notifications (BF-07, BF-13) : centre de notifications, file d'envoi des e-mails, modèles de messages.

Le texte d'une notification n'est jamais figé en base : il est produit à la lecture, dans la langue de la requête, à
partir de `type` et `donnees` (voir `evenements.py`).
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.noyau.langues import Langue


class TypeNotification(models.TextChoices):
    COMMANDE_CREEE = "commande_creee", _("Commande enregistrée")
    COMMANDE_NOUVELLE = "commande_nouvelle", _("Nouvelle commande")
    PROPOSITION_RECUE = "proposition_recue", _("Proposition reçue")
    PROPOSITION_CLIENT = "proposition_client", _("Réponse du client")
    CONTRAT_SIGNE = "contrat_signe", _("Contrat signé")
    ETAPE_CHANGEE = "etape_changee", _("Étape de commande")
    DEVIS_ENVOYE = "devis_envoye", _("Devis envoyé")
    DEMANDE_RENDU_NOUVELLE = "demande_rendu_nouvelle", _("Nouvelle demande de rendu")
    DEMANDE_RENDU_REPONDUE = "demande_rendu_repondue", _("Demande de rendu traitée")
    CONTACT_NOUVEAU = "contact_nouveau", _("Nouvelle demande de contact")
    CONTACT_REPONDU = "contact_repondu", _("Demande de contact traitée")
    MESSAGE_NOUVEAU = "message_nouveau", _("Nouveau message")
    APPEL_MANQUE = "appel_manque", _("Appel manqué")
    NOUVEAUTE = "nouveaute", _("Nouveauté")


class Notification(models.Model):
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=30, choices=TypeNotification.choices)
    # Éléments du texte (référence, nom, montant, identifiants…) : jamais de texte déjà traduit
    donnees = models.JSONField(default=dict, blank=True)
    lue = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "notification"
        verbose_name_plural = "notifications"
        ordering = ["-cree_le", "-id"]
        indexes = [models.Index(fields=["utilisateur", "lue"], name="notif_utilisateur_lue")]

    def __str__(self):
        return f"{self.type} → {self.utilisateur_id}"


class EtatEnvoi(models.TextChoices):
    EN_ATTENTE = "en_attente", "En attente"
    ENVOYE = "envoye", "Envoyé"
    ECHEC = "echec", "Échec"
    ANNULE = "annule", "Annulé"


class EnvoiEmail(models.Model):
    """File d'envoi : aucun e-mail perdu si Gmail est indisponible ou non configuré, aucun doublon (`cle_unique`)."""

    destinataire_email = models.CharField(max_length=254)
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="+")
    evenement = models.CharField(max_length=30, choices=TypeNotification.choices)
    cle_unique = models.CharField(max_length=190, unique=True)
    sujet = models.CharField(max_length=300)
    corps_texte = models.TextField()
    corps_html = models.TextField(blank=True)
    entetes = models.JSONField(default=dict, blank=True)
    etat = models.CharField(max_length=12, choices=EtatEnvoi.choices, default=EtatEnvoi.EN_ATTENTE, db_index=True)
    tentatives = models.PositiveSmallIntegerField(default=0)
    prochaine_tentative = models.DateTimeField(db_index=True)
    derniere_erreur = models.CharField(max_length=300, blank=True)
    message_id = models.CharField(max_length=200, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    envoye_le = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = "envoi d'e-mail"
        verbose_name_plural = "envois d'e-mails"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.evenement} → {self.destinataire_email} ({self.etat})"


class ModeleEmail(models.Model):
    """Texte (sujet et introduction) choisi par le super-administrateur pour un événement et une langue.

    Il remplace le texte par défaut (traduit dans les `.po`) ; le reste de l'e-mail (montants, liens) est fixé par le code.
    """

    evenement = models.CharField(max_length=30, choices=TypeNotification.choices)
    langue = models.CharField(max_length=5, choices=Langue.choices)
    sujet = models.CharField(max_length=150)
    introduction = models.CharField(max_length=1000)

    class Meta:
        verbose_name = "modèle d'e-mail"
        verbose_name_plural = "modèles d'e-mails"
        ordering = ["evenement", "langue"]
        constraints = [models.UniqueConstraint(fields=["evenement", "langue"], name="notifications_modele_unique")]

    def __str__(self):
        return f"{self.evenement} ({self.langue})"
