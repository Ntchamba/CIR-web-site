"""Contact (BF-11, BF-13) : question ou demande de rappel, envoyée par un visiteur ou un client.

Le contenu écrit (message, réponse, notes) n'est pas traduit ; `langue` garde la langue de la requête pour que
l'équipe sache dans quelle langue répondre.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.noyau.references import ReferenceMixin


class TypeDemande(models.TextChoices):
    QUESTION = "question", _("Question")
    RAPPEL = "rappel", _("Être rappelé")


class Creneau(models.TextChoices):
    MATIN = "matin", _("Matin")
    APRES_MIDI = "apres_midi", _("Après-midi")
    SOIR = "soir", _("Soir")
    PEU_IMPORTE = "peu_importe", _("Peu importe")


class EtatContact(models.TextChoices):
    NOUVELLE = "nouvelle", _("Nouvelle")
    EN_COURS = "en_cours", _("En cours")
    TRAITEE = "traitee", _("Traitée")


class DemandeContact(ReferenceMixin, models.Model):
    prefixe_reference = "CTC"

    reference = models.CharField("référence", max_length=20, unique=True, editable=False)  # CTC-2026-0001
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="demandes_contact")  # vide : visiteur sans compte
    nom = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    telephone = models.CharField("téléphone", max_length=30, blank=True)
    type = models.CharField(max_length=10, choices=TypeDemande.choices, default=TypeDemande.QUESTION)
    creneau = models.CharField("créneau de rappel", max_length=12, choices=Creneau.choices, blank=True)
    message = models.TextField(max_length=1000)
    produit = models.ForeignKey("catalogue.Produit", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="+")
    langue = models.CharField(max_length=5, default="fr")
    etat = models.CharField("état", max_length=10, choices=EtatContact.choices, default=EtatContact.NOUVELLE,
                            db_index=True)
    reponse_equipe = models.TextField("réponse de l'équipe", blank=True)
    notes_internes = models.TextField("notes internes", blank=True)  # équipe seulement
    cree_le = models.DateTimeField("reçue le", auto_now_add=True)
    traitee_le = models.DateTimeField("traitée le", null=True, blank=True)

    class Meta:
        verbose_name = "demande de contact"
        verbose_name_plural = "demandes de contact"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return self.reference
