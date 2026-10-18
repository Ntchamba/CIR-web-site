"""Règles métier des devis et des demandes de rendu. Les vues et sérialiseurs ne font qu'appeler ces fonctions.

Le calcul est dans `calcul.py`. L'envoi d'un devis crée une proposition de l'équipe dans la négociation de la
commande (`apps/commandes/negociation.py`) ; le devis réagit ensuite aux réponses par les signaux (`signals.py`).
"""
from datetime import timedelta

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import Throttled, ValidationError

from apps.catalogue.models import Produit
from apps.commandes import negociation
from apps.commandes.etapes import EQUIPE, Etat
from apps.commandes.models import Commande
from apps.noyau.medias import preparer_images

from . import calcul
from .models import (ETATS_VISIBLES_CLIENT, DemandeRendu, Devis, EtatDemande, EtatDevis, ImageDemande, LigneDevis)

QUOTA_DEMANDES_PAR_JOUR = 5
IMAGES_MAX = 5
DESCRIPTION_MIN = 20
DESCRIPTION_MAX = 1500
CHAMPS_LIGNE = ("type_ligne", "libelle", "produit", "surface_m2", "dosage_kg_m2", "prix_kg", "prix_m2",
                "montant_forfait")


# --- Lecture : devis ---

def _avec_lignes(qs):
    return qs.select_related("commande__client").prefetch_related(
        Prefetch("lignes", queryset=LigneDevis.objects.select_related("produit")))


def devis_du_client(client):
    """Devis du client : envoyés, acceptés, refusés ou remplacés (jamais les brouillons)."""
    return _avec_lignes(Devis.objects.filter(commande__client=client, etat__in=ETATS_VISIBLES_CLIENT))


def devis_equipe():
    return _avec_lignes(Devis.objects.select_related("cree_par", "commande__client"))


def resume_pour_commande(commande, request, equipe):
    """Résumé des devis d'une commande pour son détail (enregistré auprès de `commandes.extensions`)."""
    from .serializers import DevisResumeSerializer  # import tardif : les sérialiseurs importent ce module

    qs = _avec_lignes(Devis.objects.filter(commande=commande))
    if not equipe:
        qs = qs.filter(etat__in=ETATS_VISIBLES_CLIENT)
    return DevisResumeSerializer(qs, many=True, context={"request": request}).data


# --- Calcul ---

def _donnees_calcul(ligne):
    return {champ: ligne.get(champ) for champ in ("type_ligne", "surface_m2", "dosage_kg_m2", "prix_kg", "prix_m2",
                                                  "montant_forfait")}


def apercu(lignes):
    """Aperçu sans rien enregistrer : résultat de `calcul.calculer` pour des lignes saisies."""
    return calcul.calculer([_donnees_calcul(ligne) for ligne in lignes])


# --- Devis ---

def _verifier_modifiable(devis):
    if devis.etat != EtatDevis.BROUILLON:
        raise ValidationError({"detail": _("Seul un devis en brouillon peut être modifié ou supprimé.")})


def _remplacer_lignes(devis, lignes):
    devis.lignes.all().delete()
    LigneDevis.objects.bulk_create([
        LigneDevis(devis=devis, ordre=ordre, **{champ: ligne.get(champ) for champ in CHAMPS_LIGNE
                                                if champ != "libelle"},
                   libelle=" ".join(str(ligne.get("libelle") or "").split()))
        for ordre, ligne in enumerate(lignes)])


@transaction.atomic
def enregistrer_devis(devis, donnees, utilisateur):
    """Crée (devis=None) ou modifie un brouillon ; `lignes` est remplacée en entier. Aucune règle d'envoi ici."""
    donnees = dict(donnees)
    if devis is None:
        commande = donnees.get("commande")
        if commande is None:
            raise ValidationError({"commande": [_("La commande est obligatoire.")]})
        if commande.etat in (Etat.TERMINEE, Etat.ANNULEE):
            raise ValidationError({"commande": [_("Cette commande est terminée ou annulée : on ne peut plus y joindre "
                                                  "de devis.")]})
        devis = Devis(commande=commande, cree_par=utilisateur)
    else:
        _verifier_modifiable(devis)
        donnees.pop("commande", None)  # le devis reste attaché à sa commande
    demande = donnees.get("demande")
    if demande is not None and demande.client_id != devis.commande.client_id:
        raise ValidationError({"demande": [_("Cette demande de rendu appartient à un autre client.")]})
    if "demande" in donnees:
        devis.demande = demande
    if "validite_jours" in donnees:
        devis.validite_jours = donnees["validite_jours"]
    if "notes" in donnees:
        devis.notes = (donnees["notes"] or "").strip()
    devis.save()
    if "lignes" in donnees:
        _remplacer_lignes(devis, donnees["lignes"])
    return devis


def supprimer_devis(devis):
    _verifier_modifiable(devis)
    devis.delete()


@transaction.atomic
def envoyer(devis, utilisateur):
    """Envoie le devis : exige un devis complet et un total > 0 ; crée une proposition de l'équipe sur la commande.

    La commande passe en négociation si elle était « Nouvelle » ; la proposition en attente est remplacée (le devis
    qu'elle portait passe à « remplacé » par le signal). Une demande de rendu liée passe à « devis envoyé ».
    """
    devis = Devis.objects.select_for_update().get(pk=devis.pk)
    if devis.etat != EtatDevis.BROUILLON:
        raise ValidationError({"detail": _("Ce devis a déjà été envoyé.")})
    lignes = list(devis.lignes.select_related("produit"))
    if not lignes:
        raise ValidationError({"lignes": [_("Ajoutez au moins une ligne au devis.")]})
    resultat = calcul.calculer([ligne.donnees_calcul() for ligne in lignes])
    if not resultat.complet:
        raise ValidationError({"detail": _("Le devis est incomplet : renseignez toutes les surfaces et tous les "
                                           "prix avant de l'envoyer."), "erreurs": resultat.erreurs})
    if resultat.total <= 0:
        raise ValidationError({"detail": _("Le total du devis doit être supérieur à zéro.")})
    if any(not ligne.libelle_affiche for ligne in lignes):
        raise ValidationError({"lignes": [_("Chaque ligne doit avoir un libellé ou un produit.")]})
    commande = Commande.objects.get(pk=devis.commande_id)
    devis.etat = EtatDevis.ENVOYE
    devis.envoye_le = timezone.now()
    devis.save(update_fields=["etat", "envoye_le", "modifie_le"])
    negociation.proposer(commande, utilisateur, EQUIPE, {"total": resultat.total, "message": devis.notes},
                         devis=devis)
    if devis.demande_id:
        DemandeRendu.objects.filter(pk=devis.demande_id).update(etat=EtatDemande.DEVIS_ENVOYE,
                                                                modifie_le=timezone.now())
    return devis


# --- Demandes de rendu ---

def _avec_devis(qs, equipe):
    devis = Devis.objects.all() if equipe else Devis.objects.filter(etat__in=ETATS_VISIBLES_CLIENT)
    return qs.select_related("produit", "client").prefetch_related(
        "images", Prefetch("devis", queryset=devis.select_related("commande").prefetch_related(
            Prefetch("lignes", queryset=LigneDevis.objects.select_related("produit")))))


def demandes_du_client(client):
    return _avec_devis(DemandeRendu.objects.filter(client=client), equipe=False)


def demandes_equipe():
    return _avec_devis(DemandeRendu.objects.all(), equipe=True)


def resume_demandes():
    resume = {etat: DemandeRendu.objects.filter(etat=etat).count() for etat in EtatDemande.values}
    resume["total"] = sum(resume.values())
    return resume


def _verifier_quota(client):
    depuis = timezone.now() - timedelta(days=1)
    if DemandeRendu.objects.filter(client=client, cree_le__gte=depuis).count() >= QUOTA_DEMANDES_PAR_JOUR:
        raise Throttled(detail=_("Vous avez déjà envoyé %(nombre)s demandes de rendu aujourd'hui. "
                                 "Réessayez demain.") % {"nombre": QUOTA_DEMANDES_PAR_JOUR})


def _preparer_images(fichiers):
    """Convertit les images en WebP avant tout enregistrement ; une image refusée = 400 sur `images`.

    Les fichiers déjà écrits sur le disque sont effacés si l'une des images est refusée.
    """
    prets = []
    try:
        for ordre, fichier in enumerate(fichiers):
            image = ImageDemande(image=fichier, ordre=ordre)
            preparer_images(image)
            prets.append(image)
    except ValidationError as erreur:
        _effacer(prets)
        messages = erreur.detail.get("image", []) if isinstance(erreur.detail, dict) else []
        raise ValidationError({"images": messages}) from erreur
    return prets


def _effacer(images):
    for image in images:
        if image.image and image.image.name:
            image.image.storage.delete(image.image.name)


def deposer_demande(client, donnees, fichiers=()):
    """BF-11 : un client demande un rendu sur mesure (description, type, surface, produit, commande, photos)."""
    _verifier_quota(client)
    description = (donnees.get("description") or "").strip()
    if not DESCRIPTION_MIN <= len(description) <= DESCRIPTION_MAX:
        raise ValidationError({"description": [_("La description doit compter entre %(min)s et %(max)s caractères.")
                                               % {"min": DESCRIPTION_MIN, "max": DESCRIPTION_MAX}]})
    surface = donnees.get("surface_m2")
    if surface is not None and surface <= 0:
        raise ValidationError({"surface_m2": [_("La surface doit être supérieure à zéro.")]})
    produit = None
    if donnees.get("produit") is not None:
        produit = Produit.objects.filter(pk=donnees["produit"], en_ligne=True).first()
        if produit is None:
            raise ValidationError({"produit": [_("Ce produit n'est pas disponible.")]})
    commande = None
    if donnees.get("commande") is not None:  # seulement une commande du client (sinon 400 sans rien révéler)
        commande = Commande.objects.filter(pk=donnees["commande"], client=client).first()
        if commande is None:
            raise ValidationError({"commande": [_("Commande introuvable.")]})
    fichiers = list(fichiers or [])
    if len(fichiers) > IMAGES_MAX:
        raise ValidationError({"images": [_("Cinq images au plus par demande.")]})
    images = _preparer_images(fichiers)
    try:
        with transaction.atomic():
            demande = DemandeRendu.objects.create(
                client=client, description=description, type_batiment=donnees["type_batiment"], surface_m2=surface,
                produit=produit, commande=commande)
            for image in images:
                image.demande = demande
                image.save()
    except Exception:
        _effacer(images)
        raise
    return demande


def mettre_a_jour_demande(demande, donnees):
    """L'équipe : état, réponse au client, notes internes."""
    champs = []
    for champ in ("etat", "reponse_equipe", "notes_internes"):
        if champ in donnees:
            valeur = donnees[champ]
            setattr(demande, champ, valeur.strip() if isinstance(valeur, str) else valeur)
            champs.append(champ)
    if champs:
        demande.save(update_fields=champs + ["modifie_le"])
    return demande
