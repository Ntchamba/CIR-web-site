"""Filtres des listes de produits : famille, usage, nouveauté, à la une, recherche.

- Site public : `?famille=<slug>&usage=maison&nouveau=1&a_la_une=1&search=…`
- Tableau de bord : `?famille=<id>&en_ligne=1|0&search=…`
"""
import django_filters
from django.db.models import Q

from apps.noyau.langues import AUTRES_LANGUES

from .models import Produit, Usage

# Champs cherchés, en français et dans chaque traduction (valeurs du JSON `traductions`, jamais ses clés)
CHAMPS_RECHERCHE = ("nom", "accroche")

VRAI = ("1", "true", "vrai", "oui")
FAUX = ("0", "false", "faux", "non")


def _q_traductions(prefixe, champs, mot):
    """Condition « le mot figure dans une traduction » : traductions__en__nom__icontains, etc."""
    condition = Q()
    for langue in AUTRES_LANGUES:
        for champ in champs:
            condition |= Q(**{f"{prefixe}traductions__{langue}__{champ}__icontains": mot})
    return condition


def rechercher_produits(queryset, texte):
    """Recherche dans la référence, le nom, l'accroche, la famille et leurs traductions."""
    texte = " ".join(str(texte or "").split())
    if not texte:
        return queryset
    for mot in texte.split(" ")[:5]:
        queryset = queryset.filter(
            Q(reference__icontains=mot) | Q(nom__icontains=mot) | Q(accroche__icontains=mot)
            | Q(famille__nom__icontains=mot) | _q_traductions("", CHAMPS_RECHERCHE, mot)
            | _q_traductions("famille__", ("nom",), mot)
        )
    return queryset


def _booleen(queryset, champ, valeur):
    valeur = str(valeur or "").strip().lower()
    if valeur in VRAI:
        return queryset.filter(**{champ: True})
    if valeur in FAUX:
        return queryset.filter(**{champ: False})
    return queryset


class ProduitPublicFiltre(django_filters.FilterSet):
    famille = django_filters.CharFilter(field_name="famille__slug")
    usage = django_filters.ChoiceFilter(choices=Usage.choices, method="filtrer_usage")
    nouveau = django_filters.CharFilter(method="filtrer_nouveau")
    a_la_une = django_filters.CharFilter(method="filtrer_a_la_une")
    search = django_filters.CharFilter(method="filtrer_recherche")

    class Meta:
        model = Produit
        fields = ["famille", "usage", "nouveau", "a_la_une", "search"]

    def filtrer_usage(self, queryset, nom, valeur):
        return queryset.filter(**{f"pour_{valeur}": True}) if valeur else queryset

    def filtrer_nouveau(self, queryset, nom, valeur):
        return _booleen(queryset, "est_nouveau", valeur)

    def filtrer_a_la_une(self, queryset, nom, valeur):
        return _booleen(queryset, "a_la_une", valeur)

    def filtrer_recherche(self, queryset, nom, valeur):
        return rechercher_produits(queryset, valeur).distinct()


class ProduitAdminFiltre(django_filters.FilterSet):
    famille = django_filters.NumberFilter(field_name="famille_id")
    en_ligne = django_filters.CharFilter(method="filtrer_en_ligne")
    search = django_filters.CharFilter(method="filtrer_recherche")

    class Meta:
        model = Produit
        fields = ["famille", "en_ligne", "search"]

    def filtrer_en_ligne(self, queryset, nom, valeur):
        return _booleen(queryset, "en_ligne", valeur)

    def filtrer_recherche(self, queryset, nom, valeur):
        return rechercher_produits(queryset, valeur).distinct()
