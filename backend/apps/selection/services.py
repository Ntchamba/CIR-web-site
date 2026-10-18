"""Règles métier de la sélection (BF-09). Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
from django.db import transaction
from django.db.models import Prefetch
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.catalogue.models import Design, ImageProduit, Produit

from .models import ElementSelection

ELEMENTS_MAX = 50


def elements_de(utilisateur):
    """Éléments du client, avec produit, famille, vignette et design (sans requête en plus par élément)."""
    return (ElementSelection.objects.filter(utilisateur=utilisateur)
            .select_related("produit__famille", "design")
            .prefetch_related(Prefetch("produit__images", queryset=ImageProduit.objects.order_by("ordre", "id"))))


def ids_produits(utilisateur):
    """Identifiants des produits sélectionnés (sans doublon), pour griser les boutons « Ajouter »."""
    ids = ElementSelection.objects.filter(utilisateur=utilisateur).values_list("produit_id", flat=True)
    return list(dict.fromkeys(ids))


@transaction.atomic
def ajouter(utilisateur, produit_id, design_id=None):
    """Ajoute un produit (et son design) à la sélection. Renvoie (élément, créé)."""
    produit = Produit.objects.filter(pk=produit_id, en_ligne=True).first()
    if produit is None:
        raise ValidationError({"produit": [_("Ce produit n'est pas disponible.")]})
    design = None
    if design_id is not None:
        design = Design.objects.filter(pk=design_id, produit=produit).first()
        if design is None:
            raise ValidationError({"design": [_("Ce design n'appartient pas à ce produit.")]})
    existant = ElementSelection.objects.filter(utilisateur=utilisateur, produit=produit, design=design).first()
    if existant is not None:
        return existant, False
    if ElementSelection.objects.filter(utilisateur=utilisateur).count() >= ELEMENTS_MAX:
        raise ValidationError({"detail": _("Votre sélection est pleine (%(nombre)s éléments au plus).")
                               % {"nombre": ELEMENTS_MAX}})
    return ElementSelection.objects.create(utilisateur=utilisateur, produit=produit, design=design), True


def retirer(utilisateur, element):
    """Retire un élément (celui du client seulement : la vue l'a déjà filtré)."""
    element.delete()


def vider(utilisateur):
    ElementSelection.objects.filter(utilisateur=utilisateur).delete()
