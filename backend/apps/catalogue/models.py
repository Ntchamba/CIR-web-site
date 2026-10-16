"""Catalogue (BF-01, BF-05, BF-06, BF-14) : familles, produits, images, designs, fiche technique, plan de coupe.

Le texte français est dans les champs habituels ; les autres langues dans `traductions` (TraductionsMixin).
"""
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from apps.noyau.images import TAILLES, ImagesOptimiseesMixin
from apps.noyau.slugs import slug_unique
from apps.noyau.traductions import TraductionsMixin, champ_traductions

from .prix import UnitePrix


class Usage(models.TextChoices):
    """Usages d'un produit et types de chantier (libellés traduits côté front)."""

    MAISON = "maison", _("Maison")
    INDUSTRIE = "industrie", _("Industrie")
    ENTREPRISE = "entreprise", _("Entreprise")
    EXTERIEUR = "exterieur", _("Extérieur")


class Famille(TraductionsMixin, models.Model):
    champs_traduits = ("nom", "description")

    nom = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, editable=False)
    description = models.TextField(blank=True)
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "famille"
        verbose_name_plural = "familles"
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        if not self.slug:  # calculé à la création, puis stable (adresses des pages)
            self.slug = slug_unique(self, self.nom)
        super().save(*args, **kwargs)


class Produit(TraductionsMixin, models.Model):
    champs_traduits = ("nom", "accroche", "description", "domaine_application", "performances", "preparation",
                       "methode_application", "dosage", "conditions_chantier")

    famille = models.ForeignKey(Famille, on_delete=models.PROTECT, related_name="produits")
    reference = models.CharField("référence", max_length=30, blank=True)  # ex. « YD-500 »
    nom = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, editable=False)
    accroche = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    domaine_application = models.TextField("domaine d'application", blank=True)
    performances = models.TextField(blank=True)
    # Mise en œuvre
    preparation = models.TextField("préparation", blank=True)
    methode_application = models.TextField("méthode d'application", blank=True)
    dosage = models.TextField(blank=True)
    conditions_chantier = models.TextField("conditions de chantier", blank=True)
    # Usages
    pour_maison = models.BooleanField(default=False)
    pour_industrie = models.BooleanField(default=False)
    pour_entreprise = models.BooleanField(default=False)
    pour_exterieur = models.BooleanField("pour l'extérieur", default=False)
    # Prix facultatif (BF-05) : entier en FCFA ; absent = « Prix sur devis »
    prix = models.PositiveIntegerField(null=True, blank=True)
    unite_prix = models.CharField("unité du prix", max_length=10, choices=UnitePrix.choices, default=UnitePrix.M2)
    en_ligne = models.BooleanField(default=True, db_index=True)
    a_la_une = models.BooleanField("à la une", default=False)
    est_nouveau = models.BooleanField("nouveauté", default=False)
    ordre = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField("créé le", auto_now_add=True)
    modifie_le = models.DateTimeField("modifié le", auto_now=True)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "produit"
        verbose_name_plural = "produits"
        ordering = ["ordre", "nom", "id"]
        constraints = [
            models.UniqueConstraint(fields=["reference"], condition=~Q(reference=""),
                                    name="catalogue_produit_reference_unique"),
        ]

    def __str__(self):
        return f"{self.reference} {self.nom}".strip()

    def save(self, *args, **kwargs):
        if not self.slug:  # « sol-autolissant-epoxy-yd-500 » : calculé à la création, puis stable
            self.slug = slug_unique(self, f"{self.nom} {self.reference}")
        super().save(*args, **kwargs)

    @property
    def usages(self):
        """Liste des usages cochés, dans l'ordre de `Usage` : ["maison", "industrie", …]."""
        return [usage.value for usage in Usage if getattr(self, f"pour_{usage.value}")]


class ImageProduit(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    """Photo d'un produit ; la première (ordre le plus petit) sert de vignette."""

    champs_traduits = ("alt",)
    champs_images = {"image": TAILLES["moyenne"] + 320}  # 1280 px

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="catalogue/produits/")
    alt = models.CharField("texte alternatif", max_length=200, blank=True)
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "image de produit"
        verbose_name_plural = "images de produit"
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.produit} ({self.ordre})"


couleur_hexadecimale = RegexValidator(r"^#[0-9A-Fa-f]{6}$", _("Couleur attendue au format #RRGGBB."))


class Design(TraductionsMixin, ImagesOptimiseesMixin, models.Model):
    """Variante proposée au client (couleur, motif) : image facultative, couleur facultative."""

    champs_traduits = ("nom",)
    champs_images = {"image": TAILLES["moyenne"]}  # 960 px

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="designs")
    nom = models.CharField(max_length=120)
    image = models.ImageField(upload_to="catalogue/designs/", blank=True)
    couleur = models.CharField(max_length=7, blank=True, validators=[couleur_hexadecimale])
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "design"
        verbose_name_plural = "designs"
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.produit} : {self.nom}"


class Caracteristique(TraductionsMixin, models.Model):
    """Ligne du tableau des indicateurs techniques (temps de séchage, adhérence…)."""

    champs_traduits = ("libelle", "valeur")

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="caracteristiques")
    libelle = models.CharField("libellé", max_length=120)
    valeur = models.CharField(max_length=200)
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "caractéristique"
        verbose_name_plural = "caractéristiques"
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.libelle} : {self.valeur}"


class Couche(TraductionsMixin, models.Model):
    """Couche du plan de coupe : ordre 0 = surface, puis vers le support."""

    champs_traduits = ("nom",)

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="couches")
    nom = models.CharField(max_length=120)
    epaisseur = models.CharField("épaisseur", max_length=60, blank=True)  # ex. « 2 à 3 mm »
    ordre = models.PositiveIntegerField(default=0)
    traductions = champ_traductions()

    class Meta:
        verbose_name = "couche"
        verbose_name_plural = "couches"
        ordering = ["ordre", "id"]

    def __str__(self):
        return self.nom
