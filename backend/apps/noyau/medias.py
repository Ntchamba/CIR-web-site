"""Médias (images et vidéos) envoyés par l'équipe et renvoyés par l'API.

- Les URL de médias sont **absolues** : le site et le tableau de bord sont servis depuis d'autres domaines.
- Les images sont converties en WebP (`ImagesOptimiseesMixin`) ; `preparer_images` fait cette conversion
  avant l'enregistrement pour transformer une `ImageInvalide` en erreur 400 sur le bon champ.
- Les vidéos : `.mp4` ou `.webm`, taille plafonnée (`valider_video`).
- `servir_media` : service des fichiers `/media/` par Django (volume Railway), activé par
  `DJANGO_SERVIR_MEDIAS` (voir config/urls.py).
"""
from pathlib import Path

from django.conf import settings
from django.utils.translation import gettext as _
from django.views.static import serve
from rest_framework.exceptions import ValidationError

from .images import ImageInvalide, optimiser_champ_image

MO = 1024 * 1024
VIDEO_OCTETS_MAX = 50 * MO
EXTENSIONS_VIDEO = (".mp4", ".webm")
# Cache des navigateurs pour /media/ : 30 jours (un fichier remplacé reçoit un nouveau nom).
CACHE_MEDIAS_SECONDES = 30 * 24 * 60 * 60


def url_absolue(request, champ):
    """URL absolue d'un fichier (ImageField, FileField), ou None si le champ est vide."""
    if not champ:
        return None
    url = champ.url
    return request.build_absolute_uri(url) if request is not None else url


def objet_image(request, champ, alt=""):
    """Objet image de l'API publique : {"url": "https://…/media/….webp", "alt": "…"} ou None."""
    url = url_absolue(request, champ)
    return {"url": url, "alt": alt or ""} if url else None


def preparer_images(instance):
    """Convertit en WebP les images nouvellement envoyées d'un modèle `ImagesOptimiseesMixin`.

    Une image refusée (trop lourde, trop grande, illisible) devient une erreur 400 sur son champ :
    {"image": ["…"]}. La conversion n'est pas refaite par `save()` (fichier marqué comme optimisé).
    """
    for nom, largeur in getattr(instance, "champs_images", {}).items():
        try:
            optimiser_champ_image(getattr(instance, nom), largeur)
        except ImageInvalide as erreur:
            raise ValidationError({nom: [str(erreur)]}) from erreur


def enregistrer_avec_images(instance):
    """Prépare les images puis enregistre l'objet."""
    preparer_images(instance)
    instance.save()
    return instance


def _entete(fichier, longueur=16):
    position = fichier.tell() if hasattr(fichier, "tell") else 0
    try:
        fichier.seek(0)
        return fichier.read(longueur)
    finally:
        fichier.seek(position)


def valider_video(fichier, octets_max=None):
    """Contrôle une vidéo envoyée : extension .mp4 ou .webm, contenu cohérent, taille maximale
    (`octets_max`, par défaut VIDEO_OCTETS_MAX : 50 Mo).

    Lève une ValidationError de DRF (message traduit) ; renvoie le fichier sinon.
    """
    if not fichier:
        return fichier
    octets_max = octets_max or VIDEO_OCTETS_MAX
    extension = Path(getattr(fichier, "name", "") or "").suffix.lower()
    if extension not in EXTENSIONS_VIDEO:
        raise ValidationError(_("Format de vidéo non accepté : envoyez un fichier .mp4 ou .webm."))
    taille = getattr(fichier, "size", 0) or 0
    if taille > octets_max:
        raise ValidationError(_("Vidéo trop lourde (maximum %(mo)s Mo).") % {"mo": f"{octets_max / MO:g}"})
    entete = _entete(fichier)
    valide = (entete[4:8] == b"ftyp") if extension == ".mp4" else entete.startswith(b"\x1a\x45\xdf\xa3")
    if not valide:
        raise ValidationError(_("Fichier vidéo illisible."))
    return fichier


def servir_media(request, path):
    """Sert un fichier de MEDIA_ROOT avec un en-tête de cache (production : volume Railway)."""
    reponse = serve(request, path, document_root=settings.MEDIA_ROOT)
    reponse["Cache-Control"] = f"public, max-age={CACHE_MEDIAS_SECONDES}"
    return reponse
