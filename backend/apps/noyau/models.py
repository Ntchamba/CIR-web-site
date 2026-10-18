"""Modèles communs du noyau : compteurs des références séquentielles (CIR-2026-0001, DEV-…, REN-…, CTC-…)."""
from django.db import models


class CompteurReference(models.Model):
    """Dernier numéro attribué pour un préfixe et une année (voir `references.py`)."""

    prefixe = models.CharField(max_length=10)
    annee = models.PositiveSmallIntegerField()
    dernier = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "compteur de référence"
        verbose_name_plural = "compteurs de références"
        constraints = [models.UniqueConstraint(fields=["prefixe", "annee"], name="noyau_compteur_unique")]

    def __str__(self):
        return f"{self.prefixe}-{self.annee} : {self.dernier}"
