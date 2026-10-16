"""Actualités (BF-07) : nouveautés et autres produits de l'entreprise, publication immédiate ou programmée."""
from django.db import models
from django.utils import timezone

from apps.catalogue.models import Produit
from apps.noyau.images import TAILLES, ImagesOptimiseesMixin
from apps.noyau.slugs import slug_unique
from apps.noyau.traductions import TraductionsMixin, champ_traductions


class Actualite(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    champs_traduits = ("titre", "resume", "texte")
    champs_images = {"image": TAILLES["moyenne"] + 320}

    titre = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, editable=False)
    resume = models.CharField("résumé", max_length=280, blank=True)
    texte = models.TextField(blank=True)
    image = models.ImageField(upload_to="actualites/", blank=True)
    produit = models.ForeignKey(Produit, on_delete=models.SET_NULL, null=True, blank=True, related_name="actualites")
    publie = models.BooleanField("publiée", default=True, db_index=True)
    # Dans le futur : actualité programmée (invisible sur le site jusqu'à cette date)
    publie_le = models.DateTimeField("publiée le", default=timezone.now, db_index=True)
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    modifie_le = models.DateTimeField("modifiée le", auto_now=True)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "actualité"
        verbose_name_plural = "actualités"
        ordering = ["-publie_le", "-id"]

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slug_unique(self, self.titre)
        super().save(*args, **kwargs)

    @property
    def programmee(self):
        """Vrai si la date de publication est dans le futur."""
        return bool(self.publie_le and self.publie_le > timezone.now())
