"""Références séquentielles par année : « CIR-2026-0001 », « DEV-2026-0001 », « REN-… », « CTC-… ».

Le numéro vient d'un compteur en base, incrémenté par une seule requête `UPDATE … SET dernier = dernier + 1`
dans la transaction de la création : deux créations simultanées ne reçoivent jamais le même numéro (la ligne du
compteur est verrouillée jusqu'à la fin de la transaction) et un échec de création ne laisse pas de trou.
"""
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from .models import CompteurReference


def prochaine_reference(prefixe, annee=None):
    """Renvoie la référence suivante pour `prefixe` (ex. « CIR-2026-0007 »). À appeler dans la création de l'objet."""
    annee = annee or timezone.localdate().year
    with transaction.atomic():
        try:
            with transaction.atomic():
                CompteurReference.objects.get_or_create(prefixe=prefixe, annee=annee)
        except IntegrityError:  # création simultanée du compteur : l'autre l'a créé, on continue
            pass
        CompteurReference.objects.filter(prefixe=prefixe, annee=annee).update(dernier=F("dernier") + 1)
        dernier = CompteurReference.objects.values_list("dernier", flat=True).get(prefixe=prefixe, annee=annee)
    return f"{prefixe}-{annee}-{dernier:04d}"


class ReferenceMixin:
    """À placer sur un modèle ayant un champ `reference` (unique, vide à la création) et `prefixe_reference`."""

    prefixe_reference = ""

    def save(self, *args, **kwargs):
        if not self.reference:
            with transaction.atomic():  # le numéro et la création réussissent (ou échouent) ensemble
                self.reference = prochaine_reference(self.prefixe_reference)
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)
