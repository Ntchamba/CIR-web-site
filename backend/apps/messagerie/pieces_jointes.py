"""Pièces jointes de la messagerie : contrôle par la SIGNATURE du fichier, stockage privé, nettoyage du nom.

Types acceptés : images JPEG, PNG, WebP, GIF (converties en WebP, 1600 px au plus) et PDF. Tout le reste (HTML, SVG,
exécutables, archives, scripts, fichier vide) est refusé. L'extension et le type envoyés par le navigateur ne comptent
pas ; le nom envoyé n'est jamais repris pour le stockage (nom aléatoire).
"""
import re
import unicodedata
import uuid

from django.core.files.base import ContentFile
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.noyau.images import TAILLES, ImageInvalide, convertir_en_webp

from .models import PieceJointe, TypePiece

MO = 1024 * 1024
OCTETS_MAX = 10 * MO
PAR_MESSAGE_MAX = 3
NON_RATTACHEES_MAX = 10  # par compte : évite d'encombrer le disque avec des envois jamais utilisés
NOM_MAX = 150
LARGEUR_MAX = TAILLES["grande"]  # 1600 px


def type_par_signature(debut):
    """« image » ou « document » d'après les premiers octets du fichier, sinon None."""
    if debut.startswith(b"\xff\xd8\xff"):  # JPEG
        return TypePiece.IMAGE
    if debut.startswith(b"\x89PNG\r\n\x1a\n"):
        return TypePiece.IMAGE
    if debut[:4] == b"RIFF" and debut[8:12] == b"WEBP":
        return TypePiece.IMAGE
    if debut[:6] in (b"GIF87a", b"GIF89a"):
        return TypePiece.IMAGE
    if debut.startswith(b"%PDF-"):
        return TypePiece.DOCUMENT
    return None


def nettoyer_nom(nom):
    """Nom affichable : sans chemin, sans caractère de contrôle ni de mise en forme, 150 caractères au plus."""
    nom = str(nom or "").replace("\\", "/").split("/")[-1]
    nom = "".join(c for c in nom if unicodedata.category(c) not in ("Cc", "Cf", "Cs", "Co", "Cn"))
    nom = re.sub(r"\s+", " ", nom).strip().strip(".")
    if len(nom) > NOM_MAX:
        racine, point, extension = nom.rpartition(".")
        if point and 0 < len(extension) <= 10:
            nom = racine[: NOM_MAX - len(extension) - 1] + "." + extension
        else:
            nom = nom[:NOM_MAX]
    return nom or "fichier"


def _erreur(champ, message):
    return ValidationError({champ: [message]})


def preparer(fichier, champ="fichiers"):
    """Contrôle un fichier envoyé. Renvoie (type, octets à stocker, extension). 400 sur `champ` si refusé."""
    taille = getattr(fichier, "size", None)
    if taille is None or taille <= 0:
        raise _erreur(champ, _("Le fichier est vide."))
    if taille > OCTETS_MAX:
        raise _erreur(champ, _("Fichier trop lourd (maximum %(mo)s Mo).") % {"mo": OCTETS_MAX // MO})
    fichier.seek(0)
    debut = fichier.read(16)
    fichier.seek(0)
    type_piece = type_par_signature(debut)
    if type_piece is None:
        raise _erreur(champ, _("Type de fichier non accepté : envoyez une image (JPEG, PNG, WebP, GIF) ou un PDF."))
    if type_piece == TypePiece.DOCUMENT:
        return type_piece, fichier.read(), "pdf"
    try:
        octets = convertir_en_webp(fichier, largeur_max=LARGEUR_MAX, octets_max=OCTETS_MAX)
    except ImageInvalide as erreur:
        raise _erreur(champ, str(erreur)) from erreur
    return type_piece, octets, "webp"


def enregistrer(fichier, proprietaire, champ="fichiers"):
    """Contrôle puis enregistre le fichier dans le stockage privé ; renvoie la `PieceJointe` non rattachée."""
    from django.db import transaction

    type_piece, octets, extension = preparer(fichier, champ)
    piece = PieceJointe(proprietaire=proprietaire, nom_original=nettoyer_nom(getattr(fichier, "name", "")),
                        type=type_piece, taille=len(octets))
    piece.fichier.save(f"{uuid.uuid4().hex}.{extension}", ContentFile(octets), save=False)
    try:
        with transaction.atomic():
            piece.save()
    except Exception:
        piece.fichier.storage.delete(piece.fichier.name)
        raise
    return piece


def verifier_quota_non_rattachees(proprietaire):
    if PieceJointe.objects.filter(proprietaire=proprietaire, message__isnull=True).count() >= NON_RATTACHEES_MAX:
        raise ValidationError({"fichier": [_("Trop de fichiers en attente : envoyez d'abord votre message.")]})


def nom_de_telechargement(piece):
    """Nom proposé au téléchargement : le nom d'origine, avec l'extension réelle du fichier stocké."""
    extension = piece.fichier.name.rsplit(".", 1)[-1]
    racine = piece.nom_original.rsplit(".", 1)[0] if "." in piece.nom_original else piece.nom_original
    return nettoyer_nom(f"{racine}.{extension}")


def purger_non_rattachees(maintenant=None):
    """Supprime (fichier compris) les pièces jointes non rattachées depuis plus de 24 h. Renvoie leur nombre."""
    from datetime import timedelta

    from django.utils import timezone

    limite = (maintenant or timezone.now()) - timedelta(hours=24)
    pieces = PieceJointe.objects.filter(message__isnull=True, cree_le__lt=limite)
    nombre = 0
    for piece in pieces:
        piece.delete()  # le signal post_delete efface le fichier
        nombre += 1
    return nombre
