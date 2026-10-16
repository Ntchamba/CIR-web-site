"""Règles métier des contenus de l'accueil. Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.noyau.medias import MO, effacer_apres_validation, enregistrer_avec_images, preparer_remplacement, \
    supprimer_avec_fichiers

from .models import Bandeau, ContenuAccueil, PhotoSphere

VIDEO_FOND_OCTETS_MAX = 30 * MO
TELEPHONES_MAX = 6
_TELEPHONE = re.compile(r"^\+?[\d\s().-]{6,25}$")


def _texte(valeur):
    return " ".join(str(valeur or "").split())


# --- Lecture ---

def contenu_accueil():
    return ContenuAccueil.charger()


def bandeaux_actifs(aujourd_hui=None):
    """Bandeaux actifs dont la période contient le jour présent (fuseau Africa/Douala).

    `debut` et `fin` sont facultatifs et **inclus** : un bandeau qui finit aujourd'hui est encore affiché.
    """
    aujourd_hui = aujourd_hui or timezone.localdate()
    return Bandeau.objects.filter(actif=True).filter(
        Q(debut__isnull=True) | Q(debut__lte=aujourd_hui),
        Q(fin__isnull=True) | Q(fin__gte=aujourd_hui),
    )


def photos_sphere():
    return PhotoSphere.objects.select_related("produit")


def donnees_accueil():
    """Tout ce qu'affiche l'accueil, en une seule requête de l'API."""
    return {"contenu": contenu_accueil(), "bandeaux": list(bandeaux_actifs()), "sphere": list(photos_sphere())}


# --- Accueil ---

def valider_telephones(telephones):
    """Liste de numéros (« +237 6 99 81 16 35 ») : textes nettoyés, sans doublon, 6 au plus."""
    if telephones in (None, ""):
        return []
    if not isinstance(telephones, list):
        raise ValidationError({"telephones": [_("Les téléphones doivent être une liste de numéros.")]})
    propres = []
    for numero in telephones:
        if not isinstance(numero, str):
            raise ValidationError({"telephones": [_("Les téléphones doivent être une liste de numéros.")]})
        numero = _texte(numero)
        if not numero:
            continue
        if not _TELEPHONE.match(numero):
            raise ValidationError({"telephones": [_("Numéro de téléphone invalide : %(numero)s.")
                                                  % {"numero": numero}]})
        if numero not in propres:
            propres.append(numero)
    if len(propres) > TELEPHONES_MAX:
        raise ValidationError({"telephones": [_("%(max)s numéros au plus.") % {"max": TELEPHONES_MAX}]})
    return propres


@transaction.atomic
def modifier_accueil(donnees):
    contenu = contenu_accueil()
    donnees = dict(donnees)
    if "telephones" in donnees:
        donnees["telephones"] = valider_telephones(donnees["telephones"])
    if "whatsapp" in donnees:
        donnees["whatsapp"] = _texte(donnees["whatsapp"])
        if donnees["whatsapp"] and not _TELEPHONE.match(donnees["whatsapp"]):
            raise ValidationError({"whatsapp": [_("Numéro de téléphone invalide : %(numero)s.")
                                                % {"numero": donnees["whatsapp"]}]})
    for champ in ("titre", "accroche", "adresse"):
        if champ in donnees:
            donnees[champ] = _texte(donnees[champ])
    anciens = preparer_remplacement(contenu, donnees, ("video_fond", "image_affiche"))
    for champ, valeur in donnees.items():
        setattr(contenu, champ, valeur)
    enregistrer_avec_images(contenu)
    effacer_apres_validation(anciens)
    return contenu


# --- Bandeaux ---

@transaction.atomic
def enregistrer_bandeau(bandeau, donnees):
    bandeau = bandeau or Bandeau()
    donnees = dict(donnees)
    if "texte" in donnees:
        donnees["texte"] = _texte(donnees["texte"])
        if not donnees["texte"]:
            raise ValidationError({"texte": [_("Le texte est obligatoire.")]})
    for champ, valeur in donnees.items():
        setattr(bandeau, champ, valeur)
    if bandeau.debut and bandeau.fin and bandeau.fin < bandeau.debut:  # fin == début : un seul jour
        raise ValidationError({"fin": [_("La date de fin ne peut pas précéder la date de début.")]})
    bandeau.save()
    return bandeau


def supprimer_bandeau(bandeau):
    bandeau.delete()


# --- Sphère de photos ---

@transaction.atomic
def enregistrer_photo(photo, donnees):
    creation = photo is None
    photo = photo or PhotoSphere()
    donnees = dict(donnees)
    if "image" in donnees and not donnees["image"]:
        raise ValidationError({"image": [_("L'image est obligatoire.")]})
    anciens = preparer_remplacement(photo, donnees, ("image",))
    for champ, valeur in donnees.items():
        setattr(photo, champ, valeur)
    if creation and "ordre" not in donnees:
        dernier = PhotoSphere.objects.order_by("-ordre").values_list("ordre", flat=True).first()
        photo.ordre = 0 if dernier is None else dernier + 1
    enregistrer_avec_images(photo)
    effacer_apres_validation(anciens)
    return photo


def supprimer_photo(photo):
    supprimer_avec_fichiers(photo, ("image",))


@transaction.atomic
def ordonner_sphere(ids):
    """Range les photos dans l'ordre de la liste d'identifiants ; les photos non citées passent après."""
    if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
        raise ValidationError({"ids": [_("Liste d'identifiants attendue.")]})
    if len(set(ids)) != len(ids):
        raise ValidationError({"ids": [_("Un identifiant figure plusieurs fois.")]})
    photos = {p.pk: p for p in PhotoSphere.objects.select_for_update()}
    inconnus = [i for i in ids if i not in photos]
    if inconnus:
        raise ValidationError({"ids": [_("Photo introuvable : %(id)s.") % {"id": inconnus[0]}]})
    restantes = [p for p in sorted(photos.values(), key=lambda p: (p.ordre, p.pk)) if p.pk not in ids]
    ordonnees = [photos[i] for i in ids] + restantes
    for position, photo in enumerate(ordonnees):
        photo.ordre = position
    PhotoSphere.objects.bulk_update(ordonnees, ["ordre"])
    return ordonnees
