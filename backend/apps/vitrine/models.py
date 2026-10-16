"""Vitrine (BF-02, BF-03, BF-04, BF-15) : réalisations avant/après, démonstrations vidéo, témoignages modérés.

Les témoignages ne sont pas traduits : les mots du client restent tels quels, avec leur langue d'écriture.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.catalogue.models import Produit, Usage
from apps.noyau.images import TAILLES, ImagesOptimiseesMixin
from apps.noyau.langues import LANGUE_PAR_DEFAUT, Langue
from apps.noyau.slugs import slug_unique
from apps.noyau.traductions import TraductionsMixin, champ_traductions

from .videos import adresse_integration


class Realisation(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    """Chantier réalisé par le CIR : photo après (obligatoire) et avant (facultative)."""

    champs_traduits = ("titre", "description")
    champs_images = {"image_apres": TAILLES["moyenne"] + 320, "image_avant": TAILLES["moyenne"] + 320}

    titre = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, editable=False)
    type_chantier = models.CharField("type de chantier", max_length=20, choices=Usage.choices)
    ville = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    image_apres = models.ImageField("photo après", upload_to="vitrine/realisations/")
    image_avant = models.ImageField("photo avant", upload_to="vitrine/realisations/", blank=True)
    produits = models.ManyToManyField(Produit, blank=True, related_name="realisations")
    publie = models.BooleanField("publiée", default=True, db_index=True)
    date = models.DateField("date du chantier", null=True, blank=True)
    ordre = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "réalisation"
        verbose_name_plural = "réalisations"
        ordering = ["ordre", "-date", "-id"]

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slug_unique(self, self.titre)
        super().save(*args, **kwargs)


duree_video = RegexValidator(r"^\d{1,2}(:[0-5]\d){1,2}$", _("Durée attendue au format 1:45 ou 1:02:30."))


class Demo(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    """Démonstration vidéo : fichier (.mp4, .webm) ou lien YouTube / Vimeo (au moins l'un des deux)."""

    champs_traduits = ("titre", "description")
    champs_images = {"miniature": TAILLES["moyenne"]}

    titre = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    video = models.FileField("vidéo", upload_to="vitrine/demos/", blank=True)
    lien = models.URLField("lien YouTube ou Vimeo", blank=True)
    miniature = models.ImageField(upload_to="vitrine/demos/", blank=True)
    duree = models.CharField("durée", max_length=10, blank=True, validators=[duree_video])
    realisation = models.ForeignKey(Realisation, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="demos")
    publie = models.BooleanField("publiée", default=True, db_index=True)
    ordre = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "démonstration"
        verbose_name_plural = "démonstrations"
        ordering = ["ordre", "-id"]

    def __str__(self):
        return self.titre

    def clean(self):
        """Même règle que l'API (administration Django comprise) : lien YouTube ou Vimeo, vidéo ou lien."""
        super().clean()
        if self.lien and not adresse_integration(self.lien):
            raise ValidationError({"lien": _("Le lien doit mener à une vidéo YouTube ou Vimeo.")})
        if not self.video and not self.lien:
            raise ValidationError({"video": _("Envoyez une vidéo ou indiquez un lien YouTube ou Vimeo.")})


class StatutTemoignage(models.TextChoices):
    EN_ATTENTE = "en_attente", _("En attente")
    PUBLIE = "publie", _("Publié")
    REFUSE = "refuse", _("Refusé")


class Temoignage(models.Model):
    """Avis déposé par un client connecté ; publié seulement après validation par l'équipe."""

    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="temoignages")
    nom_affiche = models.CharField("nom affiché", max_length=150)
    ville = models.CharField(max_length=80, blank=True)
    type_chantier = models.CharField("type de chantier", max_length=20, choices=Usage.choices, blank=True)
    texte = models.TextField()
    note = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    langue = models.CharField("langue d'écriture", max_length=5, choices=Langue.choices,
                              default=LANGUE_PAR_DEFAUT)
    statut = models.CharField(max_length=20, choices=StatutTemoignage.choices, default=StatutTemoignage.EN_ATTENTE,
                              db_index=True)
    motif_refus = models.TextField("motif du refus", blank=True)
    cree_le = models.DateTimeField("déposé le", default=timezone.now)
    modere_le = models.DateTimeField("modéré le", null=True, blank=True)
    modere_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="+", verbose_name="modéré par")

    class Meta:
        verbose_name = "témoignage"
        verbose_name_plural = "témoignages"
        ordering = ["-cree_le", "-id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(note__gte=1, note__lte=5), name="vitrine_temoignage_note_1_5"),
        ]

    def __str__(self):
        return f"{self.nom_affiche} ({self.get_statut_display()})"
