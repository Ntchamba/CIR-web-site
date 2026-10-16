"""Règles métier du catalogue. Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.noyau.medias import effacer_apres_validation, enregistrer_avec_images, preparer_remplacement, \
    supprimer_avec_fichiers

from .models import Caracteristique, Couche, Design, Famille, ImageProduit, Produit
from .prix import normaliser_prix, valider_unite


def _appliquer(instance, donnees, exclus=()):
    for champ, valeur in donnees.items():
        if champ not in exclus:
            setattr(instance, champ, valeur)


def _texte(valeur):
    return " ".join(str(valeur or "").split())


# --- Lecture ---

def familles_publiques():
    """Familles avec le nombre de produits en ligne."""
    return Famille.objects.annotate(nombre_produits=Count("produits", filter=Q(produits__en_ligne=True)))


def familles_equipe():
    return Famille.objects.annotate(nombre_produits=Count("produits"))


def produits_publics():
    """Produits visibles sur le site (en ligne), avec leur famille et leur vignette."""
    return (Produit.objects.filter(en_ligne=True).select_related("famille")
            .prefetch_related(Prefetch("images", queryset=ImageProduit.objects.order_by("ordre", "id"))))


def produit_public_detail():
    return produits_publics().prefetch_related("designs", "caracteristiques", "couches")


def produits_equipe():
    return Produit.objects.select_related("famille").prefetch_related("images", "designs", "caracteristiques",
                                                                      "couches")


# --- Familles ---

def _verifier_nom_famille(nom, famille=None):
    nom = _texte(nom)
    if not nom:
        raise ValidationError({"nom": [_("Le nom est obligatoire.")]})
    autres = Famille.objects.filter(nom__iexact=nom)
    if famille is not None and famille.pk:
        autres = autres.exclude(pk=famille.pk)
    if autres.exists():
        raise ValidationError({"nom": [_("Une famille porte déjà ce nom.")]})
    return nom


@transaction.atomic
def enregistrer_famille(famille, donnees):
    """Crée (famille=None) ou modifie une famille."""
    famille = famille or Famille()
    if "nom" in donnees or not famille.pk:
        donnees = {**donnees, "nom": _verifier_nom_famille(donnees.get("nom"), famille)}
    _appliquer(famille, donnees)
    famille.save()  # le slug est calculé par le modèle
    return famille


def supprimer_famille(famille):
    """Une famille qui contient des produits ne se supprime pas (les déplacer d'abord)."""
    if famille.produits.exists():
        raise ValidationError({"detail": _("Cette famille contient des produits : déplacez-les ou supprimez-les "
                                           "d'abord.")})
    famille.delete()


# --- Produits ---

def _verifier_reference(reference, produit):
    reference = _texte(reference).upper()
    if reference:
        autres = Produit.objects.filter(reference__iexact=reference)
        if produit.pk:
            autres = autres.exclude(pk=produit.pk)
        if autres.exists():
            raise ValidationError({"reference": [_("Un produit porte déjà cette référence.")]})
    return reference


def _remplacer_lignes(produit, modele, lignes, champs):
    """Remplace en entier les lignes imbriquées (caractéristiques, couches) ; l'ordre suit la liste."""
    modele.objects.filter(produit=produit).delete()
    modele.objects.bulk_create([
        modele(produit=produit, ordre=position, traductions=ligne.get("traductions") or {},
               **{champ: _texte(ligne.get(champ)) for champ in champs})
        for position, ligne in enumerate(lignes)
    ])


@transaction.atomic
def enregistrer_produit(produit, donnees):
    """Crée (produit=None) ou modifie un produit, avec ses caractéristiques et ses couches.

    `caracteristiques` et `couches`, quand elles sont fournies, remplacent les listes existantes.
    """
    produit = produit or Produit()
    donnees = dict(donnees)
    caracteristiques = donnees.pop("caracteristiques", None)
    couches = donnees.pop("couches", None)
    if "nom" in donnees:
        donnees["nom"] = _texte(donnees["nom"])
        if not donnees["nom"]:
            raise ValidationError({"nom": [_("Le nom est obligatoire.")]})
    if "reference" in donnees:
        donnees["reference"] = _verifier_reference(donnees["reference"], produit)
    if "prix" in donnees:
        try:
            donnees["prix"] = normaliser_prix(donnees["prix"])
        except ValidationError as erreur:
            raise ValidationError({"prix": erreur.detail}) from erreur
    if "unite_prix" in donnees:
        valider_unite(donnees["unite_prix"])
    _appliquer(produit, donnees)
    produit.save()  # le slug est calculé par le modèle
    if caracteristiques is not None:
        _remplacer_lignes(produit, Caracteristique, caracteristiques, ("libelle", "valeur"))
    if couches is not None:
        _remplacer_lignes(produit, Couche, couches, ("nom", "epaisseur"))
    return produit


def supprimer_produit(produit):
    produit.delete()


# --- Images et designs ---

def _ordre_suivant(queryset):
    dernier = queryset.order_by("-ordre").values_list("ordre", flat=True).first()
    return 0 if dernier is None else dernier + 1


@transaction.atomic
def ajouter_image(produit, donnees):
    image = ImageProduit(produit=produit, **donnees)
    if "ordre" not in donnees:
        image.ordre = _ordre_suivant(produit.images.all())
    return enregistrer_avec_images(image)


@transaction.atomic
def modifier_image(image, donnees):
    _appliquer(image, donnees, exclus=("produit",))
    return enregistrer_avec_images(image)


def supprimer_image(image):
    supprimer_avec_fichiers(image, ("image",))


@transaction.atomic
def enregistrer_design(design, donnees, produit=None):
    """Crée (design=None, produit donné) ou modifie un design."""
    if design is None:
        design = Design(produit=produit)
        if "ordre" not in donnees:
            design.ordre = _ordre_suivant(produit.designs.all())
    donnees = dict(donnees)
    if "nom" in donnees:
        donnees["nom"] = _texte(donnees["nom"])
        if not donnees["nom"]:
            raise ValidationError({"nom": [_("Le nom est obligatoire.")]})
    if donnees.get("couleur"):
        donnees["couleur"] = donnees["couleur"].upper()
    anciens = preparer_remplacement(design, donnees, ("image",))
    _appliquer(design, donnees, exclus=("produit",))
    enregistrer_avec_images(design)
    effacer_apres_validation(anciens)
    return design


def supprimer_design(design):
    supprimer_avec_fichiers(design, ("image",))
