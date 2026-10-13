"""Optimisation des images envoyées depuis le dashboard (BNF-05).

Chaque image est réduite à une largeur maximale puis convertie en WebP : le catalogue reste
léger même avec une connexion lente.
"""
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

LARGEUR_MAX = 1280
QUALITE = 72


def optimiser_image(champ, largeur_max=LARGEUR_MAX, qualite=QUALITE):
    """Convertit le fichier d'un ImageField en WebP (sans agrandir) avant l'enregistrement."""
    if not champ or getattr(champ, "_cir_optimise", False):
        return
    nom = Path(champ.name).stem
    if champ.name.lower().endswith(".webp") and getattr(champ, "_committed", True):
        return  # déjà optimisée et enregistrée
    champ.open()
    image = ImageOps.exif_transpose(Image.open(champ))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    if image.width > largeur_max:
        hauteur = round(image.height * largeur_max / image.width)
        image = image.resize((largeur_max, hauteur), Image.LANCZOS)
    tampon = BytesIO()
    image.save(tampon, "WEBP", quality=qualite, method=6)
    champ.save(f"{nom}.webp", ContentFile(tampon.getvalue()), save=False)
    champ._cir_optimise = True


class ImagesOptimiseesMixin:
    """À placer sur un modèle : liste les champs image à convertir et leur largeur maximale."""

    champs_images = {}  # {"nom_du_champ": largeur_max}

    def save(self, *args, **kwargs):
        for nom, largeur in self.champs_images.items():
            champ = getattr(self, nom)
            if champ and not getattr(champ, "_committed", True):
                optimiser_image(champ, largeur)
        super().save(*args, **kwargs)
