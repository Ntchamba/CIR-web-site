"""Calcul d'un devis (BF-11) : la **seule source de vérité** ; le tableau de bord l'appelle (`POST calculer/`).

Trois types de ligne :
- `materiau` : quantité (kg) = arrondi_2(surface × dosage) ; montant = arrondi(quantité × prix au kg) ;
- `surface`  : montant = arrondi(surface × prix au m²) (la pose comprise ou non est dite par le libellé) ;
- `forfait`  : montant saisi.
Tous les arrondis se font en `Decimal`, demi vers le haut. Le total est la somme des montants des lignes.
Le prix d'une ligne est saisi par l'équipe : jamais inventé ici. Une ligne à laquelle il manque une surface, un
dosage ou un prix n'a pas de montant et est signalée dans `erreurs`.
"""
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from django.db import models
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy

from apps.noyau.montants import MONTANT_MAX


class TypeLigne(models.TextChoices):
    MATERIAU = "materiau", gettext_lazy("Matériau")
    SURFACE = "surface", gettext_lazy("Surface")
    FORFAIT = "forfait", gettext_lazy("Forfait")


def arrondir(valeur, decimales=0):
    """Arrondi à `decimales` chiffres, demi vers le haut (2,5 → 3 ; 12,345 → 12,35 à 2 décimales)."""
    return Decimal(valeur).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP)


@dataclass
class ResultatLigne:
    quantite_kg: Decimal | None = None
    montant: int | None = None
    erreurs: list = field(default_factory=list)  # [(champ, message)]


@dataclass
class ResultatDevis:
    lignes: list
    total: int
    complet: bool
    erreurs: list  # [{"ligne": index (à partir de 0), "champ": …, "message": …}]


def _manque(valeur):
    return valeur is None


def _positif(valeur, champ, message_manque, resultat, strict=True):
    """Vérifie qu'une valeur est présente (et > 0 si `strict`) ; ajoute l'erreur sinon."""
    if _manque(valeur):
        resultat.erreurs.append((champ, message_manque))
        return False
    if strict and Decimal(valeur) <= 0:
        resultat.erreurs.append((champ, _("La valeur doit être supérieure à zéro.")))
        return False
    return True


def calculer_ligne(ligne):
    """`ligne` : dict avec type_ligne, surface_m2, dosage_kg_m2, prix_kg, prix_m2, montant_forfait."""
    resultat = ResultatLigne()
    type_ligne = ligne.get("type_ligne")
    if type_ligne == TypeLigne.MATERIAU:
        surface_ok = _positif(ligne.get("surface_m2"), "surface_m2", _("La surface est obligatoire."), resultat)
        dosage_ok = _positif(ligne.get("dosage_kg_m2"), "dosage_kg_m2", _("Le dosage est obligatoire."), resultat)
        prix_ok = _positif(ligne.get("prix_kg"), "prix_kg", _("Le prix au kg est obligatoire."), resultat,
                           strict=False)
        if surface_ok and dosage_ok:
            resultat.quantite_kg = arrondir(Decimal(ligne["surface_m2"]) * Decimal(ligne["dosage_kg_m2"]), 2)
            if prix_ok:
                resultat.montant = int(arrondir(resultat.quantite_kg * Decimal(ligne["prix_kg"])))
    elif type_ligne == TypeLigne.SURFACE:
        surface_ok = _positif(ligne.get("surface_m2"), "surface_m2", _("La surface est obligatoire."), resultat)
        prix_ok = _positif(ligne.get("prix_m2"), "prix_m2", _("Le prix au m² est obligatoire."), resultat,
                           strict=False)
        if surface_ok and prix_ok:
            resultat.montant = int(arrondir(Decimal(ligne["surface_m2"]) * Decimal(ligne["prix_m2"])))
    elif type_ligne == TypeLigne.FORFAIT:
        if _positif(ligne.get("montant_forfait"), "montant_forfait", _("Le montant du forfait est obligatoire."),
                    resultat, strict=False):
            resultat.montant = int(ligne["montant_forfait"])
    else:
        resultat.erreurs.append(("type_ligne", _("Type de ligne inconnu.")))
    if resultat.montant is not None and resultat.montant > MONTANT_MAX:
        resultat.montant = None
        resultat.erreurs.append(("montant", _("Le montant dépasse le maximum accepté (%(max)s FCFA).")
                                 % {"max": MONTANT_MAX}))
    return resultat


def calculer(lignes):
    """Calcule toutes les lignes ; `complet` est faux s'il manque une surface, un dosage ou un prix (ou aucune ligne)."""
    resultats = [calculer_ligne(ligne) for ligne in lignes]
    erreurs = [{"ligne": i, "champ": champ, "message": message}
               for i, resultat in enumerate(resultats) for champ, message in resultat.erreurs]
    total = sum(r.montant for r in resultats if r.montant is not None)
    if total > MONTANT_MAX:
        erreurs.append({"ligne": None, "champ": "total",
                        "message": _("Le total dépasse le montant maximal accepté (%(max)s FCFA).")
                        % {"max": MONTANT_MAX}})
    return ResultatDevis(lignes=resultats, total=total, complet=bool(resultats) and not erreurs, erreurs=erreurs)
