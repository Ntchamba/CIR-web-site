"""Règles métier des actualités. Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.noyau.medias import enregistrer_avec_images

from .models import Actualite


def actualites_publiques():
    """Actualités publiées dont la date de publication est passée, de la plus récente à la plus ancienne."""
    return (Actualite.objects.filter(publie=True, publie_le__lte=timezone.now())
            .select_related("produit").order_by("-publie_le", "-id"))


def actualites_equipe():
    return Actualite.objects.select_related("produit")


@transaction.atomic
def enregistrer_actualite(actualite, donnees):
    """Crée (actualite=None) ou modifie une actualité ; `publie_le` dans le futur la programme."""
    actualite = actualite or Actualite()
    donnees = dict(donnees)
    if "titre" in donnees:
        donnees["titre"] = " ".join(str(donnees["titre"] or "").split())
        if not donnees["titre"]:
            raise ValidationError({"titre": [_("Le titre est obligatoire.")]})
    if "publie_le" in donnees and donnees["publie_le"] is None:
        donnees["publie_le"] = timezone.now()
    if "image" in donnees and not donnees["image"]:
        if actualite.image:
            actualite.image.delete(save=False)
        donnees["image"] = ""
    for champ, valeur in donnees.items():
        setattr(actualite, champ, valeur)
    return enregistrer_avec_images(actualite)


def supprimer_actualite(actualite):
    if actualite.image:
        actualite.image.delete(save=False)
    actualite.delete()
