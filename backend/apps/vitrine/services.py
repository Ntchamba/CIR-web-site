"""Règles métier de la vitrine. Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError

from apps.noyau.langues import langue_active
from apps.noyau.medias import effacer_apres_validation, enregistrer_avec_images, preparer_remplacement, \
    supprimer_avec_fichiers

from . import moderation
from .models import Demo, Realisation, StatutTemoignage, Temoignage

QUOTA_TEMOIGNAGES_PAR_JOUR = 5

_ID_YOUTUBE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_ID_VIMEO = re.compile(r"^\d{4,12}$")
HOTES_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com",
                 "www.youtube-nocookie.com"}
HOTES_VIMEO = {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}


def _texte(valeur):
    return " ".join(str(valeur or "").split())


def _appliquer(instance, donnees, exclus=()):
    for champ, valeur in donnees.items():
        if champ not in exclus:
            setattr(instance, champ, valeur)


# --- Vidéos : adresse d'intégration YouTube ou Vimeo ---

def adresse_integration(lien):
    """Adresse à placer dans une iframe : youtube-nocookie.com/embed/… ou player.vimeo.com/video/….

    Renvoie None si le lien n'est ni une vidéo YouTube ni une vidéo Vimeo reconnue.
    """
    if not lien:
        return None
    adresse = urlparse(str(lien).strip())
    if adresse.scheme not in ("http", "https"):
        return None
    hote = (adresse.hostname or "").lower()
    morceaux = [m for m in adresse.path.split("/") if m]
    identifiant = None
    if hote in HOTES_YOUTUBE:
        if morceaux[:1] == ["watch"]:
            identifiant = (parse_qs(adresse.query).get("v") or [None])[0]
        elif len(morceaux) >= 2 and morceaux[0] in ("embed", "shorts", "live", "v"):
            identifiant = morceaux[1]
        if identifiant and _ID_YOUTUBE.match(identifiant):
            return f"https://www.youtube-nocookie.com/embed/{identifiant}"
        return None
    if hote == "youtu.be":
        identifiant = morceaux[0] if morceaux else None
        return f"https://www.youtube-nocookie.com/embed/{identifiant}" if identifiant and _ID_YOUTUBE.match(
            identifiant) else None
    if hote in HOTES_VIMEO:
        numeros = [m for m in morceaux if _ID_VIMEO.match(m)]
        return f"https://player.vimeo.com/video/{numeros[-1]}" if numeros else None
    return None


# --- Lecture ---

def realisations_publiques():
    return Realisation.objects.filter(publie=True).prefetch_related("produits")


def demos_publiques():
    return Demo.objects.filter(publie=True)


def temoignages_publics():
    return Temoignage.objects.filter(statut=StatutTemoignage.PUBLIE)


def temoignages_de(utilisateur):
    return Temoignage.objects.filter(auteur=utilisateur)


# --- Réalisations ---

@transaction.atomic
def enregistrer_realisation(realisation, donnees):
    """Crée (realisation=None) ou modifie une réalisation ; `produits` (liste) remplace les produits liés."""
    realisation = realisation or Realisation()
    donnees = dict(donnees)
    produits = donnees.pop("produits", None)
    if "titre" in donnees:
        donnees["titre"] = _texte(donnees["titre"])
        if not donnees["titre"]:
            raise ValidationError({"titre": [_("Le titre est obligatoire.")]})
    if "ville" in donnees:
        donnees["ville"] = _texte(donnees["ville"])
    if "image_apres" in donnees and not donnees["image_apres"]:
        raise ValidationError({"image_apres": [_("La photo après les travaux est obligatoire.")]})
    anciens = preparer_remplacement(realisation, donnees, ("image_apres", "image_avant"))
    _appliquer(realisation, donnees)
    enregistrer_avec_images(realisation)
    if produits is not None:
        realisation.produits.set(produits)
    effacer_apres_validation(anciens)
    return realisation


def supprimer_realisation(realisation):
    supprimer_avec_fichiers(realisation, ("image_apres", "image_avant"))


# --- Démonstrations ---

@transaction.atomic
def enregistrer_demo(demo, donnees):
    """Crée (demo=None) ou modifie une démonstration : vidéo envoyée ou lien YouTube / Vimeo (au moins un)."""
    demo = demo or Demo()
    donnees = dict(donnees)
    if "titre" in donnees:
        donnees["titre"] = _texte(donnees["titre"])
        if not donnees["titre"]:
            raise ValidationError({"titre": [_("Le titre est obligatoire.")]})
    if "lien" in donnees:
        donnees["lien"] = str(donnees["lien"] or "").strip()
        if donnees["lien"] and not adresse_integration(donnees["lien"]):
            raise ValidationError({"lien": [_("Le lien doit mener à une vidéo YouTube ou Vimeo.")]})
    anciens = preparer_remplacement(demo, donnees, ("video", "miniature"))
    _appliquer(demo, donnees)
    if not demo.video and not demo.lien:
        raise ValidationError({"video": [_("Envoyez une vidéo ou indiquez un lien YouTube ou Vimeo.")]})
    enregistrer_avec_images(demo)
    effacer_apres_validation(anciens)
    return demo


def supprimer_demo(demo):
    supprimer_avec_fichiers(demo, ("video", "miniature"))


# --- Témoignages ---

def peut_temoigner(utilisateur):
    """Seul un client connecté (pas un membre de l'équipe) dépose un témoignage."""
    return bool(utilisateur and utilisateur.is_authenticated and utilisateur.is_active
                and not getattr(utilisateur, "est_equipe", False))


def deposer_temoignage(utilisateur, *, texte, note, ville="", type_chantier=""):
    """BF-04 : un client dépose un témoignage, en attente de validation par l'équipe.

    Le nom affiché est celui du compte ; la langue d'écriture est celle de la requête. Quota : 5 par jour.
    """
    if not peut_temoigner(utilisateur):
        raise PermissionDenied(_("Seuls les clients connectés peuvent déposer un témoignage."))
    depuis = timezone.now() - timedelta(days=1)
    if temoignages_de(utilisateur).filter(cree_le__gte=depuis).count() >= QUOTA_TEMOIGNAGES_PAR_JOUR:
        raise Throttled(detail=_("Vous avez déjà déposé %(nombre)s témoignages aujourd'hui. Réessayez demain.")
                        % {"nombre": QUOTA_TEMOIGNAGES_PAR_JOUR})
    texte = moderation.verifier_texte(texte)
    if not isinstance(note, int) or isinstance(note, bool) or not 1 <= note <= 5:
        raise ValidationError({"note": [_("La note doit être comprise entre 1 et 5.")]})
    return Temoignage.objects.create(
        auteur=utilisateur,
        nom_affiche=_texte(utilisateur.nom_complet)[:150],
        ville=_texte(ville)[:80],
        type_chantier=type_chantier or "",
        texte=texte,
        note=note,
        langue=langue_active(),
    )


def publier_temoignage(temoignage, moderateur):
    return moderation.publier(temoignage, moderateur)


def refuser_temoignage(temoignage, moderateur, motif=""):
    return moderation.refuser(temoignage, moderateur, motif)


def supprimer_temoignage(temoignage):
    temoignage.delete()
