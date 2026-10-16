"""Conversion des images envoyées en WebP léger (BNF-05 : pages rapides même en connexion lente).

Chaque image est tournée selon ses données EXIF, réduite à une largeur maximale (sans agrandir)
puis enregistrée en WebP.
"""
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.utils.translation import gettext as _
from PIL import Image, ImageOps

# Largeurs usuelles (en pixels) selon l'usage de l'image
TAILLES = {"vignette": 480, "moyenne": 960, "grande": 1600}
LARGEUR_MAX = TAILLES["moyenne"] + 320  # 1280 px par défaut
QUALITE = 72
OCTETS_MAX = 10 * 1024 * 1024  # 10 Mo par fichier envoyé
PIXELS_MAX = 40_000_000  # 40 mégapixels (ex. 8000 x 5000)


class ImageInvalide(ValueError):
    """Fichier refusé : trop lourd, trop grand en pixels ou illisible."""


def taille_en_octets(source):
    if isinstance(source, (str, Path)):
        return Path(source).stat().st_size
    taille = getattr(source, "size", None)
    if isinstance(taille, int):
        return taille
    position = source.tell()
    source.seek(0, 2)
    taille = source.tell()
    source.seek(position)
    return taille


def convertir_en_webp(source, largeur_max=LARGEUR_MAX, qualite=QUALITE,
                      octets_max=OCTETS_MAX, pixels_max=PIXELS_MAX):
    """Lit une image (chemin ou fichier ouvert) et renvoie ses octets au format WebP.

    Refuse (ImageInvalide) les fichiers de plus de `octets_max` octets ou de plus de `pixels_max`
    pixels, avant de décoder l'image (protection contre les « bombes de décompression »).
    """
    if taille_en_octets(source) > octets_max:
        raise ImageInvalide(_("Image trop lourde (maximum %(mo)s Mo).") % {"mo": f"{octets_max / (1024 * 1024):g}"})
    try:
        ouverte = Image.open(source)
    except Exception as erreur:  # noqa: BLE001 - tout fichier illisible est refusé de la même façon
        raise ImageInvalide(_("Fichier image illisible.")) from erreur
    with ouverte:
        if ouverte.width * ouverte.height > pixels_max:
            raise ImageInvalide(_("Image trop grande (nombre de pixels)."))
        image = ImageOps.exif_transpose(ouverte)
        if image.mode not in ("RGB", "RGBA"):
            transparente = "A" in image.getbands() or image.has_transparency_data
            image = image.convert("RGBA" if transparente else "RGB")
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
