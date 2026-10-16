"""Contenus de l'accueil (BF-15, O2) : textes et médias, coordonnées, bandeaux, sphère de photos.

Tant que l'équipe n'a rien saisi, les valeurs sont vides : le site affiche alors ses propres textes par défaut.
"""
import re

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalogue.models import Produit
from apps.noyau.images import TAILLES, ImagesOptimiseesMixin
from apps.noyau.traductions import TraductionsMixin, champ_traductions


class ContenuAccueil(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    """Enregistrement unique (clé 1) : utiliser `ContenuAccueil.charger()`."""

    champs_traduits = ("titre", "accroche", "texte_partenaire")
    champs_images = {"image_affiche": TAILLES["grande"]}

    titre = models.CharField(max_length=160, blank=True)
    accroche = models.CharField(max_length=300, blank=True)
    video_fond = models.FileField("vidéo de fond", upload_to="contenus/", blank=True)
    image_affiche = models.ImageField("image de la vidéo", upload_to="contenus/", blank=True)
    texte_partenaire = models.TextField("texte sur le partenaire Jiuye", blank=True)
    # Coordonnées publiques (en-tête, pied de page)
    telephones = models.JSONField("téléphones", default=list, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    email = models.EmailField("e-mail", blank=True)
    adresse = models.CharField(max_length=200, blank=True)
    modifie_le = models.DateTimeField("modifié le", auto_now=True)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "contenu de l'accueil"
        verbose_name_plural = "contenu de l'accueil"

    def __str__(self):
        return "Accueil"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def charger(cls):
        contenu, _cree = cls.objects.get_or_create(pk=1)
        return contenu


_CHEMIN_INTERNE = re.compile(r"^/(?!/)[^\s\\]*$")


def lien_interne(valeur):
    """Lien d'un bandeau : chemin interne au site (« /catalogue »), jamais une autre adresse.

    Refuse « //hote », les barres obliques inversées, les espaces et les caractères de contrôle.
    """
    if valeur and (not _CHEMIN_INTERNE.match(valeur) or any(ord(c) < 32 or ord(c) == 127 for c in valeur)):
        raise ValidationError(_("Le lien doit être un chemin du site commençant par « / »."))


class Bandeau(TraductionsMixin, models.Model):
    """Message court en haut de l'accueil, affiché s'il est actif et dans ses dates."""

    champs_traduits = ("texte",)

    texte = models.CharField(max_length=200)
    lien = models.CharField(max_length=200, blank=True, validators=[lien_interne])
    actif = models.BooleanField(default=True)
    debut = models.DateTimeField("début", null=True, blank=True)
    fin = models.DateTimeField(null=True, blank=True)
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "bandeau"
        verbose_name_plural = "bandeaux"
        ordering = ["ordre", "id"]

    def __str__(self):
        return self.texte


class PhotoSphere(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    """Photo de la sphère de l'accueil ; un clic mène au produit lié."""

    champs_traduits = ("alt",)
    champs_images = {"image": TAILLES["vignette"]}

    image = models.ImageField(upload_to="contenus/sphere/")
    alt = models.CharField("texte alternatif", max_length=200, blank=True)
    produit = models.ForeignKey(Produit, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "photo de la sphère"
        verbose_name_plural = "photos de la sphère"
        ordering = ["ordre", "id"]

    def __str__(self):
        return self.alt or f"Photo {self.pk}"
