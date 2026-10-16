"""Outils communs aux tests de la vague 1 (catalogue, vitrine, actualités, contenus)."""
import shutil
import tempfile
from io import BytesIO

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import translation
from PIL import Image

from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role

MDP = "Resine-Epoxy-2026!"
ADRESSE = {"ville": "Douala", "quartier": "Bonapriso", "rue_ou_repere": "Près de la pharmacie"}


def image_png(nom="photo.png", largeur=40, hauteur=30, couleur=(17, 119, 168)):
    tampon = BytesIO()
    Image.new("RGB", (largeur, hauteur), couleur).save(tampon, "PNG")
    return SimpleUploadedFile(nom, tampon.getvalue(), content_type="image/png")


def video_mp4(nom="demo.mp4", taille=64):
    contenu = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * max(0, taille - 12)
    return SimpleUploadedFile(nom, contenu, content_type="video/mp4")


def creer_membre(email="membre@cir.cm"):
    return Utilisateur.objects.create_user(email, MDP, nom_complet="Membre CIR", role=Role.MEMBRE)


def creer_client(email="client@exemple.cm", nom="Client Test"):
    return Utilisateur.objects.create_user(email, MDP, nom_complet=nom, **ADRESSE)


class MediasTemporairesMixin:
    """MEDIA_ROOT dans un dossier temporaire, effacé après chaque test ; langue remise à zéro."""

    def setUp(self):
        super().setUp()
        cache.clear()
        dossier = tempfile.mkdtemp(prefix="cir-medias-")
        self.addCleanup(shutil.rmtree, dossier, ignore_errors=True)
        reglage = override_settings(MEDIA_ROOT=dossier)
        reglage.enable()
        self.addCleanup(reglage.disable)
        self.addCleanup(translation.deactivate)
