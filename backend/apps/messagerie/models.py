"""Messagerie (BF-11) : une conversation par client, ses messages et leurs pièces jointes privées.

Le texte des messages est écrit par les utilisateurs : il n'est jamais traduit ni interprété comme du HTML.
"""
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .stockage import stockage_prive

TEXTE_MAX = 2000


class RoleAuteur(models.TextChoices):
    CLIENT = "client", "Client"
    EQUIPE = "equipe", "Équipe"


class TypePiece(models.TextChoices):
    IMAGE = "image", "Image"
    DOCUMENT = "document", "Document"


class Conversation(models.Model):
    """Fil de discussion d'un client avec l'équipe (une seule par client, créée à la demande)."""

    client = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="conversation")
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    dernier_message_le = models.DateTimeField("dernier message le", null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = "conversation"
        verbose_name_plural = "conversations"
        ordering = ["-dernier_message_le", "-id"]

    def __str__(self):
        return f"Conversation de {self.client_id}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="messages_ecrits")
    auteur_role = models.CharField(max_length=10, choices=RoleAuteur.choices)
    texte = models.TextField(max_length=TEXTE_MAX, blank=True)
    # « À propos de CIR-2026-0001 » : doit appartenir au client de la conversation
    commande = models.ForeignKey("commandes.Commande", on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="+")
    # Identifiant choisi par le navigateur : un envoi rejoué ne crée pas de doublon
    cle_client = models.CharField(max_length=64, blank=True)
    cree_le = models.DateTimeField("envoyé le", auto_now_add=True, db_index=True)
    # Date à laquelle L'AUTRE partie a lu le message
    lu_le = models.DateTimeField("lu le", null=True, blank=True)

    class Meta:
        verbose_name = "message"
        verbose_name_plural = "messages"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["conversation", "cle_client"], condition=~Q(cle_client=""),
                                    name="messagerie_cle_client_unique"),
        ]
        indexes = [models.Index(fields=["conversation", "auteur_role", "lu_le"], name="messagerie_non_lus")]

    def __str__(self):
        return f"Message {self.pk}"


class PieceJointe(models.Model):
    """Fichier joint à un message (image convertie en WebP ou PDF), stocké hors de `/media/`."""

    message = models.ForeignKey(Message, on_delete=models.CASCADE, null=True, blank=True,
                                related_name="pieces_jointes")
    proprietaire = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    fichier = models.FileField(upload_to="messagerie/%Y/%m/", storage=stockage_prive, max_length=200)
    nom_original = models.CharField(max_length=150)
    type = models.CharField(max_length=10, choices=TypePiece.choices)
    taille = models.PositiveIntegerField()
    cree_le = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "pièce jointe"
        verbose_name_plural = "pièces jointes"
        ordering = ["id"]

    def __str__(self):
        return self.nom_original


@receiver(post_delete, sender=PieceJointe)
def effacer_fichier(sender, instance, **kwargs):
    """Supprime le fichier du disque quand la pièce jointe disparaît (message, purge, suppression)."""
    if instance.fichier and instance.fichier.name:
        instance.fichier.storage.delete(instance.fichier.name)
