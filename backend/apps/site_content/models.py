from django.db import models

from apps.core.images import ImagesOptimiseesMixin


class ContenuAccueil(models.Model):
    """BF-15 : textes et médias de l'accueil et du pied de page. Un seul enregistrement."""

    titre = models.CharField(max_length=60, default="Révélation")
    accroche = models.CharField(
        max_length=240,
        default="Là où naissent les sols durables : la résine époxy pour la maison, l'industrie et l'entreprise.",
    )
    video = models.FileField("vidéo de fond", upload_to="accueil/", blank=True,
                             help_text="Vide : la vidéo fournie avec le site est utilisée.")
    telephone = models.CharField(max_length=30, default="+237 678 829 313")
    whatsapp = models.CharField(max_length=30, default="+237 622 191 931")
    email = models.EmailField(blank=True)
    adresse = models.CharField(max_length=200, default="Douala, Cameroun")
    texte_partenaire = models.CharField(max_length=200, default="Partenaire fabricant : Jiuye")

    class Meta:
        verbose_name = "contenu de l'accueil"

    def __str__(self):
        return "Contenu de l'accueil"

    def save(self, *args, **kwargs):
        self.pk = 1  # enregistrement unique
        super().save(*args, **kwargs)

    @classmethod
    def charger(cls):
        objet, _ = cls.objects.get_or_create(pk=1)
        return objet


class PhotoSphere(ImagesOptimiseesMixin, models.Model):
    """Photo de la sphère de l'accueil ; un clic mène au produit lié."""

    champs_images = {"image": 480}

    image = models.ImageField(upload_to="sphere/")
    alt = models.CharField("texte alternatif", max_length=160, blank=True)
    produit = models.ForeignKey("catalog.Produit", on_delete=models.SET_NULL, null=True, blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]
        verbose_name = "photo de la sphère"
