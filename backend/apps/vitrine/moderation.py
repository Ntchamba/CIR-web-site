"""Modération des témoignages (BF-04) : contrôle du texte, publication, refus.

Un témoignage est déposé « en attente » ; seul un membre de l'équipe le publie ou le refuse (avec un motif
facultatif, visible par son auteur). Le texte ne doit contenir ni lien, ni adresse e-mail, ni numéro de
téléphone : la vitrine n'est pas un espace de publicité ou de démarchage.
"""
import re

from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from .models import StatutTemoignage

TEXTE_MIN = 20
TEXTE_MAX = 800
MOTIF_MAX = 500

_LIEN = re.compile(
    r"(https?://|www\.|\b[\w-]+\.(com|net|org|info|biz|cm|fr|io|co|me|ly|be|de|cn|jp|app|site|online|shop)\b)",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Au moins 8 chiffres, séparés ou non par des espaces, points, tirets ou parenthèses (« +237 6 99 81 16 35 »)
_TELEPHONE = re.compile(r"(?:\+?\d[\s.\-()]*){8,}")


def nettoyer_texte(texte):
    """Espaces superflus retirés ; les retours à la ligne (paragraphes) sont conservés."""
    lignes = [" ".join(ligne.split()) for ligne in str(texte or "").strip().splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lignes)).strip()


def verifier_texte(texte):
    """Contrôle le texte d'un témoignage et le renvoie nettoyé (erreur 400 sur le champ `texte` sinon)."""
    texte = nettoyer_texte(texte)
    if len(texte) < TEXTE_MIN:
        raise ValidationError({"texte": [_("Le témoignage doit compter au moins %(min)s caractères.")
                                         % {"min": TEXTE_MIN}]})
    if len(texte) > TEXTE_MAX:
        raise ValidationError({"texte": [_("Le témoignage ne doit pas dépasser %(max)s caractères.")
                                         % {"max": TEXTE_MAX}]})
    if _EMAIL.search(texte):
        raise ValidationError({"texte": [_("Le témoignage ne doit pas contenir d'adresse e-mail.")]})
    if _LIEN.search(texte):
        raise ValidationError({"texte": [_("Le témoignage ne doit pas contenir de lien.")]})
    if _TELEPHONE.search(texte):
        raise ValidationError({"texte": [_("Le témoignage ne doit pas contenir de numéro de téléphone.")]})
    return texte


def verifier_ville(ville):
    """La ville d'un témoignage : texte court, sans lien, adresse e-mail ni numéro de téléphone."""
    ville = " ".join(str(ville or "").split())
    if _EMAIL.search(ville) or _LIEN.search(ville) or _TELEPHONE.search(ville):
        raise ValidationError({"ville": [_("La ville ne doit contenir ni lien, ni adresse e-mail, ni numéro de "
                                           "téléphone.")]})
    return ville


def publier(temoignage, moderateur):
    """Publie un témoignage (en attente ou refusé auparavant)."""
    temoignage.statut = StatutTemoignage.PUBLIE
    temoignage.motif_refus = ""
    temoignage.modere_le = timezone.now()
    temoignage.modere_par = moderateur
    temoignage.save(update_fields=["statut", "motif_refus", "modere_le", "modere_par"])
    return temoignage


def refuser(temoignage, moderateur, motif=""):
    """Refuse un témoignage ; le motif (facultatif) est montré à son auteur."""
    motif = nettoyer_texte(motif)
    if len(motif) > MOTIF_MAX:
        raise ValidationError({"motif": [_("Le motif ne doit pas dépasser %(max)s caractères.") % {"max": MOTIF_MAX}]})
    temoignage.statut = StatutTemoignage.REFUSE
    temoignage.motif_refus = motif
    temoignage.modere_le = timezone.now()
    temoignage.modere_par = moderateur
    temoignage.save(update_fields=["statut", "motif_refus", "modere_le", "modere_par"])
    return temoignage
