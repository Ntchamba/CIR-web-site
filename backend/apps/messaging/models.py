from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """Fil de discussion entre un client et l'équipe : lié à une commande, ou général."""

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    commande = models.OneToOneField("orders.Commande", on_delete=models.CASCADE, null=True, blank=True,
                                    related_name="conversation")
    sujet = models.CharField(max_length=160, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-modifie_le"]

    def __str__(self):
        return self.sujet or f"Conversation {self.pk}"

    def accessible_par(self, utilisateur):
        return bool(utilisateur and utilisateur.is_authenticated
                    and (utilisateur.is_staff or utilisateur.pk == self.client_id))


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    est_systeme = models.BooleanField(default=False)  # « Étape : contrat signé », etc.
    texte = models.TextField(max_length=4000)
    lu_par_client = models.BooleanField(default=False)
    lu_par_equipe = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cree_le"]
        indexes = [models.Index(fields=["conversation", "cree_le"])]
