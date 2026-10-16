"""Traduction du contenu saisi par l'équipe (catalogue, réalisations, actualités, contenus…).

Principe (fiche de décision 7) : le texte français reste dans les champs habituels du modèle (nom,
description…) ; les autres langues sont rangées dans un seul champ JSON `traductions` :

    {"en": {"nom": "Self-levelling epoxy", "description": "…"}, "zh": {"nom": "自流平环氧地坪"}}

Une traduction absente ou vide affiche le texte français : une page n'a jamais de champ vide. Ajouter une
langue ne demande aucune migration.

Usage dans un module :

    class Produit(TraductionsMixin, models.Model):
        champs_traduits = ("nom", "description")
        nom = models.CharField(max_length=120)
        description = models.TextField(blank=True)
        traductions = champ_traductions()

    # API publique : nom et description arrivent dans la langue de la requête (Accept-Language)
    class ProduitSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer): ...

    # Tableau de bord : textes français + champ `traductions` modifiable et contrôlé
    class ProduitAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer): ...
"""
from django.db import models
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from .langues import AUTRES_LANGUES, LANGUE_PAR_DEFAUT, code_court, langue_active


def champ_traductions():
    """Champ JSON des traductions d'un modèle (vide par défaut)."""
    return models.JSONField("traductions", default=dict, blank=True)


class TraductionsMixin:
    """À placer sur un modèle qui a un champ `traductions` ; `champs_traduits` liste les champs concernés."""

    champs_traduits = ()

    def traduit(self, champ, langue=None):
        """Texte de `champ` dans `langue` (par défaut celle de la requête), sinon le texte français."""
        francais = getattr(self, champ)
        code = code_court(langue) if langue else langue_active()
        if code == LANGUE_PAR_DEFAUT:
            return francais
        texte = ((getattr(self, "traductions", None) or {}).get(code) or {}).get(champ)
        return texte if isinstance(texte, str) and texte.strip() else francais

    def langues_incompletes(self):
        """Langues où il manque au moins une traduction d'un champ rempli en français (tableau de bord)."""
        remplis = [c for c in self.champs_traduits if str(getattr(self, c) or "").strip()]
        traductions = getattr(self, "traductions", None) or {}
        return [
            code for code in AUTRES_LANGUES
            if any(not str((traductions.get(code) or {}).get(c) or "").strip() for c in remplis)
        ]


def valider_traductions(valeur, champs):
    """Contrôle et nettoie un dictionnaire de traductions envoyé par le tableau de bord.

    Accepte seulement les langues autres que le français et les champs traduisibles, avec du texte.
    Les espaces autour des textes sont retirés ; les textes vides et les langues vides sont supprimés.
    """
    if valeur in (None, ""):
        return {}
    if not isinstance(valeur, dict):
        raise ValidationError(_("Les traductions doivent être un objet {langue: {champ: texte}}."))
    propres = {}
    for langue, textes in valeur.items():
        if langue not in AUTRES_LANGUES:
            raise ValidationError(_("Langue non prise en charge : %(langue)s.") % {"langue": langue})
        if not isinstance(textes, dict):
            raise ValidationError(_("Les traductions doivent être un objet {langue: {champ: texte}}."))
        nettoyes = {}
        for champ, texte in textes.items():
            if champ not in champs:
                raise ValidationError(_("Ce champ ne se traduit pas : %(champ)s.") % {"champ": champ})
            if texte is None:
                continue
            if not isinstance(texte, str):
                raise ValidationError(_("Une traduction doit être un texte (%(champ)s).") % {"champ": champ})
            if texte.strip():
                nettoyes[champ] = texte.strip()
        if nettoyes:
            propres[langue] = nettoyes
    return propres


class SerialiseurTraduitMixin:
    """API publique : remplace chaque champ traduit par son texte dans la langue de la requête.

    Le champ `traductions` (toutes les langues) n'est pas envoyé au site public.
    """

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        for champ in getattr(instance, "champs_traduits", ()):
            if champ in donnees:
                donnees[champ] = instance.traduit(champ)
        donnees.pop("traductions", None)
        return donnees


class SerialiseurTraductionsAdminMixin:
    """Tableau de bord : le champ `traductions` est modifiable et contrôlé par `valider_traductions`.

    Ajoute `langues_incompletes` à la réponse pour signaler à l'équipe les traductions à compléter.
    """

    def validate_traductions(self, valeur):
        return valider_traductions(valeur, self.Meta.model.champs_traduits)

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        if hasattr(instance, "langues_incompletes"):
            donnees["langues_incompletes"] = instance.langues_incompletes()
        return donnees
