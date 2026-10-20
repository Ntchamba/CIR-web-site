"""Appels audio ou vidéo (BF-11) : le client appelle, l'équipe répond ; la salle est une salle Jitsi (JaaS)."""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.noyau.references import ReferenceMixin


class TypeAppel(models.TextChoices):
    AUDIO = "audio", _("Audio")
    VIDEO = "video", _("Vidéo")


class EtatAppel(models.TextChoices):
    SONNE = "sonne", _("Sonne")
    EN_COURS = "en_cours", _("En cours")
    TERMINE = "termine", _("Terminé")
    MANQUE = "manque", _("Manqué")
    REFUSE = "refuse", _("Refusé")
    ANNULE = "annule", _("Annulé")


ETATS_ACTIFS = (EtatAppel.SONNE, EtatAppel.EN_COURS)


class Appel(ReferenceMixin, models.Model):
    prefixe_reference = "APP"

    reference = models.CharField("référence", max_length=20, unique=True, editable=False)  # APP-2026-0001
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="appels")
    type = models.CharField(max_length=5, choices=TypeAppel.choices)
    commande = models.ForeignKey("commandes.Commande", on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="+")
    # Aléatoire (« cir- » + 24 caractères hexadécimaux), jamais devinable, jamais réutilisée
    salle = models.CharField(max_length=32, unique=True, editable=False)
    etat = models.CharField("état", max_length=10, choices=EtatAppel.choices, default=EtatAppel.SONNE, db_index=True)
    repondu_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="appels_repondus")
    cree_le = models.DateTimeField("lancé le", auto_now_add=True, db_index=True)
    demarre_le = models.DateTimeField("démarré le", null=True, blank=True, db_index=True)
    termine_le = models.DateTimeField("terminé le", null=True, blank=True)
    # Un appel manqué est « vu » quand l'équipe ouvre la liste (pastille du menu)
    manque_vu = models.BooleanField(default=False)

    class Meta:
        verbose_name = "appel"
        verbose_name_plural = "appels"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return self.reference

    @property
    def duree_secondes(self):
        if self.demarre_le and self.termine_le:
            return max(0, int((self.termine_le - self.demarre_le).total_seconds()))
        return None
