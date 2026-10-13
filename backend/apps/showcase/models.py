from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import TypeBatiment
from apps.core.images import ImagesOptimiseesMixin


class TypeChantier(models.TextChoices):
    MAISON = "maison", "Maison"
    INDUSTRIE = "industrie", "Industrie"
    ENTREPRISE = "entreprise", "Entreprise"
    EXTERIEUR = "exterieur", "Extérieur"


class Realisation(ImagesOptimiseesMixin, models.Model):
    """BF-02 : chantier réalisé, avec photos avant et après."""

    champs_images = {"image": 1280, "image_avant": 1280}

    titre = models.CharField(max_length=140)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    type_chantier = models.CharField(max_length=20, choices=TypeChantier.choices, default=TypeChantier.MAISON)
    ville = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField("photo (après)", upload_to="realisations/")
    image_avant = models.ImageField("photo avant travaux", upload_to="realisations/", blank=True)
    produits = models.ManyToManyField("catalog.Produit", blank=True, related_name="realisations")
    publie = models.BooleanField("publiée", default=True)
    date = models.DateField(default=timezone.localdate)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "-date"]
        verbose_name = "réalisation"

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        if not self.slug:
            base, n = slugify(self.titre) or "realisation", 2
            self.slug = base
            while Realisation.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug, n = f"{base}-{n}", n + 1
        super().save(*args, **kwargs)


class PhotoRealisation(ImagesOptimiseesMixin, models.Model):
    champs_images = {"image": 1280}

    realisation = models.ForeignKey(Realisation, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="realisations/")
    legende = models.CharField(max_length=160, blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]


class Demo(ImagesOptimiseesMixin, models.Model):
    """BF-03 : courte vidéo de démonstration (fichier envoyé ou lien YouTube)."""

    champs_images = {"miniature": 960}

    titre = models.CharField(max_length=140)
    video = models.FileField(upload_to="demos/", blank=True)
    lien = models.URLField("lien externe", blank=True)
    miniature = models.ImageField(upload_to="demos/", blank=True)
    duree = models.CharField("durée", max_length=10, blank=True)
    publie = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "-id"]
        verbose_name = "démonstration"

    def __str__(self):
        return self.titre


class Temoignage(models.Model):
    """BF-04 : témoignage client. Publié seulement après validation par l'équipe (BF-15)."""

    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente"
        PUBLIE = "publie", "Publié"
        REFUSE = "refuse", "Refusé"

    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="temoignages")
    nom_client = models.CharField(max_length=120)
    type_batiment = models.CharField(max_length=20, choices=TypeBatiment.choices, default=TypeBatiment.MAISON)
    ville = models.CharField(max_length=80, blank=True)
    texte = models.TextField(max_length=800)
    note = models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1), MaxValueValidator(5)])
    statut = models.CharField(max_length=12, choices=Statut.choices, default=Statut.EN_ATTENTE)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "témoignage"

    def __str__(self):
        return f"{self.nom_client} ({self.get_statut_display()})"
