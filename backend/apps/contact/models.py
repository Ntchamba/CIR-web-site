from django.conf import settings
from django.db import models

from apps.accounts.models import TypeBatiment


class DemandeContact(models.Model):
    """BF-11 : message du formulaire de contact ou demande de design sur mesure."""

    class Objet(models.TextChoices):
        QUESTION = "question", "Question"
        DEVIS = "devis", "Demande de devis"
        SUR_MESURE = "sur_mesure", "Design sur mesure"
        RAPPEL = "rappel", "Être rappelé"

    nom = models.CharField(max_length=120)
    telephone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    objet = models.CharField(max_length=20, choices=Objet.choices, default=Objet.QUESTION)
    type_batiment = models.CharField(max_length=20, choices=TypeBatiment.choices, default=TypeBatiment.MAISON)
    surface_m2 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    message = models.TextField(max_length=2000)
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    traitee = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "demande de contact"

    def __str__(self):
        return f"{self.nom} : {self.get_objet_display()}"
