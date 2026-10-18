"""Règles métier du contact. Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
import re
from datetime import timedelta

from django.core.exceptions import ValidationError as ErreurDjango
from django.core.validators import validate_email
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import Throttled, ValidationError

from apps.catalogue.models import Produit
from apps.noyau.langues import langue_active

from .models import Creneau, DemandeContact, EtatContact, TypeDemande

QUOTA_COMPTE_PAR_JOUR = 10
MESSAGE_MIN = 5
MESSAGE_MAX = 1000
_TELEPHONE = re.compile(r"^\+?[0-9 ().\-]{6,30}$")
_LIEN = re.compile(r"https?:|www\.", re.IGNORECASE)


def _texte(valeur):
    return " ".join(str(valeur or "").split())


def _email(valeur):
    valeur = _texte(valeur).lower()
    if valeur:
        try:
            validate_email(valeur)
        except ErreurDjango as erreur:
            raise ValidationError({"email": [_("Adresse e-mail invalide.")]}) from erreur
    return valeur


def _telephone(valeur):
    valeur = _texte(valeur)
    if valeur and (not _TELEPHONE.match(valeur) or sum(c.isdigit() for c in valeur) < 6):
        raise ValidationError({"telephone": [_("Numéro de téléphone invalide.")]})
    return valeur


def _message(valeur, visiteur):
    message = str(valeur or "").strip()
    if not MESSAGE_MIN <= len(message) <= MESSAGE_MAX:
        raise ValidationError({"message": [_("Le message doit compter entre %(min)s et %(max)s caractères.")
                                           % {"min": MESSAGE_MIN, "max": MESSAGE_MAX}]})
    if visiteur and _LIEN.search(message):
        raise ValidationError({"message": [_("Le message ne doit pas contenir de lien.")]})
    return message


def _verifier_quota_compte(utilisateur):
    depuis = timezone.now() - timedelta(days=1)
    if DemandeContact.objects.filter(auteur=utilisateur, cree_le__gte=depuis).count() >= QUOTA_COMPTE_PAR_JOUR:
        raise Throttled(detail=_("Vous avez déjà envoyé %(nombre)s messages aujourd'hui. Réessayez demain.")
                        % {"nombre": QUOTA_COMPTE_PAR_JOUR})


def demandes_de(utilisateur):
    return DemandeContact.objects.filter(auteur=utilisateur).select_related("produit")


def creer_demande(donnees, utilisateur=None):
    """Enregistre une demande de contact (question ou rappel).

    Visiteur : `nom` et (`email` ou `telephone`) obligatoires. Compte connecté : nom, e-mail et téléphone omis
    sont repris du compte. Rappel : `telephone` obligatoire. Le champ piège est traité par la vue.
    """
    connecte = bool(utilisateur and utilisateur.is_authenticated)
    if connecte:
        _verifier_quota_compte(utilisateur)
    type_demande = donnees.get("type") or TypeDemande.QUESTION
    nom = _texte(donnees.get("nom"))
    email = _email(donnees.get("email"))
    telephone = _telephone(donnees.get("telephone"))
    if connecte:
        nom = nom or _texte(utilisateur.nom_complet)
        email = email or _email(utilisateur.email)
        telephone = telephone or _texte(utilisateur.telephone)
    erreurs = {}
    if not nom:
        erreurs["nom"] = [_("Le nom est obligatoire.")]
    if type_demande == TypeDemande.RAPPEL and not telephone:
        erreurs["telephone"] = [_("Le téléphone est obligatoire pour être rappelé.")]
    elif not email and not telephone:
        erreurs["email"] = [_("Indiquez une adresse e-mail ou un numéro de téléphone.")]
    if erreurs:
        raise ValidationError(erreurs)
    message = _message(donnees.get("message"), visiteur=not connecte)
    produit = None
    if donnees.get("produit") is not None:
        produit = Produit.objects.filter(pk=donnees["produit"], en_ligne=True).first()
        if produit is None:
            raise ValidationError({"produit": [_("Ce produit n'est pas disponible.")]})
    creneau = ""
    if type_demande == TypeDemande.RAPPEL:
        creneau = donnees.get("creneau") or Creneau.PEU_IMPORTE
    return DemandeContact.objects.create(
        auteur=utilisateur if connecte else None, nom=nom[:150], email=email, telephone=telephone,
        type=type_demande, creneau=creneau, message=message, produit=produit, langue=langue_active())


def faux_succes():
    """Réponse factice au robot du champ piège : même forme qu'un vrai succès, rien d'enregistré."""
    return {"id": 0, "reference": f"CTC-{timezone.localdate().year}-0000"}


# --- Équipe ---

def demandes_equipe():
    return DemandeContact.objects.select_related("auteur", "produit")


def resume_equipe():
    resume = {etat: DemandeContact.objects.filter(etat=etat).count() for etat in EtatContact.values}
    resume["total"] = sum(resume.values())
    return resume


def mettre_a_jour(demande, donnees):
    """L'équipe : état, réponse, notes. `traitee_le` est posé en passant à « traitée » (effacé si elle est rouverte)."""
    champs = []
    for champ in ("reponse_equipe", "notes_internes"):
        if champ in donnees:
            setattr(demande, champ, (donnees[champ] or "").strip())
            champs.append(champ)
    if "etat" in donnees and donnees["etat"] != demande.etat:
        demande.etat = donnees["etat"]
        demande.traitee_le = timezone.now() if demande.etat == EtatContact.TRAITEE else None
        champs += ["etat", "traitee_le"]
    if champs:
        demande.save(update_fields=champs)
    return demande
