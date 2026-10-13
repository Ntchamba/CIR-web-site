from django.db import models
from django.utils import timezone

from apps.core.images import ImagesOptimiseesMixin


class Nouveaute(ImagesOptimiseesMixin, models.Model):
    """BF-07 : nouveauté (nouveau produit, nouvelle finition, annonce)."""

    champs_images = {"image": 1280}

    titre = models.CharField(max_length=140)
    texte = models.TextField(blank=True)
    produit = models.ForeignKey("catalog.Produit", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="nouveautes")
    image = models.ImageField(upload_to="nouveautes/", blank=True)
    publie = models.BooleanField(default=True)
    publie_le = models.DateTimeField("date de publication", default=timezone.now)

    class Meta:
        ordering = ["-publie_le"]
        verbose_name = "nouveauté"

    def __str__(self):
        return self.titre
