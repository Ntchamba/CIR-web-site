"""Prix d'un produit (BF-05) : facultatif, entier en FCFA, avec son unité.

Un prix absent s'affiche « Prix sur devis » sur le site (`prix(valeur, unite)` de @partage/utils/format.js).
Aucun prix n'est inventé : seule l'équipe en saisit un. L'API le renvoie en chaîne (« 12500 ») ou null.
"""
from django.db import models
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

PRIX_MAX = 1_000_000_000  # garde-fou contre une faute de frappe (et la limite de la colonne)


class UnitePrix(models.TextChoices):
    M2 = "m2", gettext_lazy("par m²")
    KG = "kg", gettext_lazy("par kg")
    POSE = "pose", gettext_lazy("pose comprise")


def normaliser_prix(valeur):
    """Prix saisi → entier en FCFA, ou None (« Prix sur devis »).

    Accepte un entier ou une chaîne de chiffres (« 12500 », « 12 500 ») ; refuse les nombres négatifs,
    décimaux ou démesurés.
    """
    if valeur is None or (isinstance(valeur, str) and not valeur.strip()):
        return None
    if isinstance(valeur, bool):
        raise ValidationError(_("Le prix doit être un nombre entier de francs CFA."))
    if isinstance(valeur, float):
        if not valeur.is_integer():
            raise ValidationError(_("Le prix doit être un nombre entier de francs CFA."))
        valeur = int(valeur)
    if isinstance(valeur, str):
        texte = "".join(valeur.split()).replace(" ", "")
        if texte.startswith("-") and texte[1:].isdigit():
            raise ValidationError(_("Le prix ne peut pas être négatif."))
        if not texte.isdigit():
            raise ValidationError(_("Le prix doit être un nombre entier de francs CFA."))
        valeur = int(texte)
    if not isinstance(valeur, int):
        raise ValidationError(_("Le prix doit être un nombre entier de francs CFA."))
    if valeur < 0:
        raise ValidationError(_("Le prix ne peut pas être négatif."))
    if valeur > PRIX_MAX:
        raise ValidationError(_("Le prix est trop élevé."))
    return valeur


def valider_unite(unite):
    if unite not in UnitePrix.values:
        raise ValidationError({"unite_prix": [_("Unité de prix inconnue.")]})
    return unite


def prix_en_texte(prix):
    """Représentation de l'API : « 12500 » ou None."""
    return None if prix is None else str(prix)


class ChampPrix(serializers.Field):
    """Champ de sérialiseur du prix : chaîne ou null en sortie, entier ou chaîne de chiffres en entrée."""

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        super().__init__(**kwargs)

    def validate_empty_values(self, data):
        if data == "":
            return True, None
        return super().validate_empty_values(data)

    def to_internal_value(self, data):
        return normaliser_prix(data)

    def to_representation(self, valeur):
        return prix_en_texte(valeur)
