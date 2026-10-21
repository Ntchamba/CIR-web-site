"""Assistant IA (O1, O4) : conversations du conseiller, brouillons de l'agent de fond, journal et compteurs.

Le texte écrit par les clients et par l'assistant n'est pas traduit. Le journal ne contient jamais de texte.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.noyau.langues import LANGUE_PAR_DEFAUT, Langue


class ConversationAssistant(models.Model):
    cle = models.UUIDField("clé", default=uuid.uuid4, unique=True, editable=False)  # identifiant public
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
                                    related_name="+")  # vide : visiteur sans compte
    langue = models.CharField(max_length=5, choices=Langue.choices, default=LANGUE_PAR_DEFAUT)
    contexte = models.JSONField("contexte", default=dict, blank=True)  # page de départ
    cree_le = models.DateTimeField("créée le", default=timezone.now)
    derniere_activite_le = models.DateTimeField("dernière activité le", default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "conversation de l'assistant"
        verbose_name_plural = "conversations de l'assistant"
        ordering = ["-derniere_activite_le", "-id"]

    def __str__(self):
        return f"Conversation {self.cle}"


class RoleMessage(models.TextChoices):
    UTILISATEUR = "utilisateur", "Utilisateur"
    ASSISTANT = "assistant", "Assistant"


class MessageAssistant(models.Model):
    conversation = models.ForeignKey(ConversationAssistant, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=12, choices=RoleMessage.choices)
    texte = models.TextField(max_length=2000)
    outils = models.JSONField("outils appelés", default=list, blank=True)  # noms seulement, sans résultats
    liens = models.JSONField("liens autorisés", default=list, blank=True)  # [{libelle, chemin}]
    bloque = models.CharField("garde-fou", max_length=30, blank=True)  # code du garde-fou, vide sinon
    utile = models.BooleanField("réponse utile", null=True, blank=True)  # avis du client
    jetons_entree = models.PositiveIntegerField(default=0)
    jetons_sortie = models.PositiveIntegerField(default=0)
    duree_ms = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField("créé le", default=timezone.now)

    class Meta:
        verbose_name = "message de l'assistant"
        verbose_name_plural = "messages de l'assistant"
        ordering = ["id"]

    def __str__(self):
        return f"Message {self.pk} ({self.role})"


class TypeBrouillon(models.TextChoices):
    REPONSE_CONTACT = "reponse_contact", "Réponse à une demande de contact"
    REPONSE_MESSAGE = "reponse_message", "Réponse à un message"
    TRADUCTION = "traduction", "Traduction"


class EtatBrouillon(models.TextChoices):
    PROPOSE = "propose", "Proposé"
    ACCEPTE = "accepte", "Accepté"
    MODIFIE = "modifie", "Accepté avec modifications"
    REJETE = "rejete", "Rejeté"


class Brouillon(models.Model):
    """Proposition de l'agent de fond. Jamais envoyée ni publiée automatiquement : l'équipe la relit."""

    type = models.CharField(max_length=20, choices=TypeBrouillon.choices, db_index=True)
    cible_type = models.CharField(max_length=30, blank=True)  # demande_contact, conversation_messagerie, texte
    cible_id = models.PositiveIntegerField(null=True, blank=True)
    langue = models.CharField(max_length=5, choices=Langue.choices, default=LANGUE_PAR_DEFAUT)
    contenu = models.JSONField(default=str, blank=True)  # texte, ou {langue: texte} pour une traduction
    etat = models.CharField(max_length=10, choices=EtatBrouillon.choices, default=EtatBrouillon.PROPOSE,
                            db_index=True)
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
                                 related_name="+")
    traite_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="+")
    bloque = models.CharField("garde-fou", max_length=30, blank=True)
    cree_le = models.DateTimeField("créé le", default=timezone.now)
    traite_le = models.DateTimeField("traité le", null=True, blank=True)

    class Meta:
        verbose_name = "brouillon"
        verbose_name_plural = "brouillons"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return f"Brouillon {self.pk} ({self.type})"


class ResultatJournal(models.TextChoices):
    OK = "ok", "Réussi"
    BLOQUE = "bloque", "Bloqué par un garde-fou"
    ERREUR_TEMPORAIRE = "erreur_temporaire", "Erreur temporaire"
    ERREUR = "erreur", "Erreur"
    LIMITE = "limite", "Limite atteinte"
    CONSULTATION = "consultation", "Consultation"


class AgentIA(models.TextChoices):
    CONSEILLER = "conseiller", "Conseiller"
    FOND = "fond", "Agent de fond"


class JournalAssistant(models.Model):
    """Une ligne par appel à Gemini. Jamais le texte (il est dans MessageAssistant) ni de donnée personnelle."""

    agent = models.CharField(max_length=12, choices=AgentIA.choices, db_index=True)
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="+")
    modele = models.CharField(max_length=80, blank=True)
    outils = models.JSONField(default=list, blank=True)  # noms des outils demandés
    resultat = models.CharField(max_length=20, choices=ResultatJournal.choices, db_index=True)
    code = models.CharField(max_length=40, blank=True)
    jetons_entree = models.PositiveIntegerField(default=0)
    jetons_sortie = models.PositiveIntegerField(default=0)
    duree_ms = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "ligne du journal de l'assistant"
        verbose_name_plural = "journal de l'assistant"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return f"{self.agent} {self.resultat}"


class CompteurAssistant(models.Model):
    """Messages d'assistant du jour pour tout le site. Sa ligne est verrouillée pour réserver un message
    (plafond global ASSISTANT_LIMITE_JOUR, même sous concurrence)."""

    jour = models.DateField(unique=True)
    nombre = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "compteur du jour"
        verbose_name_plural = "compteurs du jour"

    def __str__(self):
        return f"{self.jour} : {self.nombre}"


class UsageAssistant(models.Model):
    """Registre des messages réservés (limites par visiteur et par client). Il survit à l'effacement d'une
    conversation : supprimer sa conversation ne remet pas les compteurs à zéro."""

    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
                                    related_name="+")
    cle = models.UUIDField(null=True, blank=True)
    cree_le = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "usage de l'assistant"
        verbose_name_plural = "usages de l'assistant"
        indexes = [models.Index(fields=["utilisateur", "cree_le"], name="assistant_usage_user"),
                   models.Index(fields=["cle", "cree_le"], name="assistant_usage_cle")]
