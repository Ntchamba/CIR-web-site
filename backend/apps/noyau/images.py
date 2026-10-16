"""Conversion des images envoyées en WebP léger (BNF-05 : pages rapides même en connexion lente).

Chaque image est tournée selon ses données EXIF, réduite à une largeur maximale (sans agrandir)
puis enregistrée en WebP.
"""
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

# Largeurs usuelles (en pixels) selon l'usage de l'image
TAILLES = {"vignette": 480, "moyenne": 960, "grande": 1600}
LARGEUR_MAX = TAILLES["moyenne"] + 320  # 1280 px par défaut
QUALITE = 72


def convertir_en_webp(source, largeur_max=LARGEUR_MAX, qualite=QUALITE):
    """Lit une image (chemin ou fichier ouvert) et renvoie ses octets au format WebP."""
    with Image.open(source) as ouverte:
        image = ImageOps.exif_transpose(ouverte)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        if image.width > largeur_max:
            hauteur = max(1, round(image.height * largeur_max / image.width))
            image = image.resize((largeur_max, hauteur), Image.LANCZOS)
        tampon = BytesIO()
        image.save(tampon, "WEBP", quality=qualite, method=6)
    return tampon.getvalue()


def optimiser_champ_image(champ, largeur_max=LARGEUR_MAX, qualite=QUALITE):
    """Remplace le fichier d'un ImageField non encore enregistré par sa version WebP."""
    if not champ or getattr(champ, "_committed", True) or getattr(champ, "_cir_optimise", False):
        return
    nom = Path(champ.name).stem
    champ.open()
    champ.seek(0)
    octets = convertir_en_webp(champ, largeur_max, qualite)
    champ.save(f"{nom}.webp", ContentFile(octets), save=False)
    champ._cir_optimise = True


class ImagesOptimiseesMixin:
    """À placer sur un modèle : `champs_images = {"photo": 1280}` (nom du champ → largeur max)."""

    champs_images = {}

    def save(self, *args, **kwargs):
        for nom, largeur in self.champs_images.items():
            optimiser_champ_image(getattr(self, nom), largeur)
        super().save(*args, **kwargs)
