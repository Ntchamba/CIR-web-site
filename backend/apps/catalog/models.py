from django.db import models
from django.utils.text import slugify

from apps.core.images import ImagesOptimiseesMixin


class Famille(models.Model):
    """Famille de produits du catalogue Jiuye (finitions, primaires, sans solvant…)."""

    nom = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    description = models.TextField(blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        self.slug = self.slug or slugify(self.nom)
        super().save(*args, **kwargs)


class Produit(models.Model):
    """Produit ou design de revêtement (BF-01). Le prix est facultatif : sans prix, « sur devis » (BF-05)."""

    class Unite(models.TextChoices):
        M2 = "m2", "FCFA / m²"
        KG = "kg", "FCFA / kg"
        POSE = "pose", "FCFA / m², pose comprise"

    nom = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    reference = models.CharField("référence Jiuye", max_length=40, blank=True)
    famille = models.ForeignKey(Famille, on_delete=models.PROTECT, related_name="produits")
    accroche = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)

    pour_maison = models.BooleanField(default=True)
    pour_industrie = models.BooleanField(default=False)
    pour_entreprise = models.BooleanField(default=False)
    pour_exterieur = models.BooleanField(default=False)

    prix = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    unite_prix = models.CharField(max_length=10, choices=Unite.choices, default=Unite.M2)

    # Détails techniques (BF-06) : durabilité, beauté, confort
    durabilite = models.TextField(blank=True)
    beaute = models.TextField("beauté", blank=True)
    confort = models.TextField(blank=True)
    mise_en_oeuvre = models.TextField("mise en œuvre", blank=True)

    en_ligne = models.BooleanField("visible sur le site", default=True)
    a_la_une = models.BooleanField("à la une de l'accueil", default=False)
    est_nouveau = models.BooleanField("nouveauté", default=False)
    ordre = models.PositiveSmallIntegerField(default=0)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["ordre", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.reference})" if self.reference else self.nom

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.nom)
            slug, n = base, 2
            while Produit.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, n = f"{base}-{n}", n + 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def usages(self):
        return [nom for nom, actif in (("maison", self.pour_maison), ("industrie", self.pour_industrie),
                                       ("entreprise", self.pour_entreprise), ("exterieur", self.pour_exterieur))
                if actif]


class ImageProduit(ImagesOptimiseesMixin, models.Model):
    """Photos d'un produit ; la première sert de vignette dans le catalogue."""

    champs_images = {"image": 1280}

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="produits/")
    alt = models.CharField("texte alternatif", max_length=160, blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]


class Caracteristique(models.Model):
    """Ligne libre de la fiche technique : épaisseur, séchage, résistance…"""

    produit = models.ForeignKey(Produit, on_delete=models.CASCADE, related_name="caracteristiques")
    libelle = models.CharField("libellé", max_length=80)
    valeur = models.CharField(max_length=160)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]
