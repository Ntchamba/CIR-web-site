"""Règles métier des commandes. Les vues et sérialiseurs ne font qu'appeler ces fonctions.

La machine à états est dans `etapes.py`, la négociation dans `negociation.py`, le contrat dans `contrats.py`.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import BooleanField, Count, Exists, ExpressionWrapper, OuterRef, Prefetch, Q
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError

from apps.catalogue.models import Design, ImageProduit, Produit
from apps.comptes.services import peut_commander
from apps.noyau.verrous import verrouiller_compte
from apps.selection import services as selection

from . import negociation
from .etapes import CLIENT, EQUIPE, ETATS_NEGOCIABLES, Etat, changer_etat
from .models import ChangementEtat, Commande, EtatProposition, LigneCommande, Proposition

QUOTA_COMMANDES_PAR_JOUR = 5
LIGNES_MAX = 50
DESCRIPTION_MAX = 1500


def _texte(valeur):
    return " ".join(str(valeur or "").split())


# --- Lecture ---

def _avec_action_requise(qs, role):
    """Annote `action_requise` : de quel côté une réponse est attendue (une seule requête pour toute la liste)."""
    if role == CLIENT:
        attente = Proposition.objects.filter(commande=OuterRef("pk"), etat=EtatProposition.EN_ATTENTE,
                                             auteur_role=EQUIPE)
        return qs.annotate(action_requise=Exists(attente))
    attente = Proposition.objects.filter(commande=OuterRef("pk"), etat=EtatProposition.EN_ATTENTE,
                                         auteur_role=CLIENT)
    return qs.annotate(action_requise=ExpressionWrapper(Q(Exists(attente)) | Q(etat=Etat.NOUVELLE),
                                                        output_field=BooleanField()))


def commandes_du_client(client):
    return (_avec_action_requise(Commande.objects.filter(client=client), CLIENT)
            .annotate(nombre_lignes=Count("lignes", distinct=True)).order_by("-cree_le", "-id"))


def commandes_equipe():
    return (_avec_action_requise(Commande.objects.select_related("client"), EQUIPE)
            .annotate(nombre_lignes=Count("lignes", distinct=True)).order_by("-cree_le", "-id"))


def avec_detail(qs):
    """Précharge tout ce que le détail d'une commande affiche (lignes, vignettes, propositions, historique)."""
    return (qs.select_related("client")
            .prefetch_related(
                Prefetch("lignes", queryset=LigneCommande.objects.select_related("produit", "design")
                         .prefetch_related(Prefetch("produit__images",
                                                    queryset=ImageProduit.objects.order_by("ordre", "id")))),
                Prefetch("propositions", queryset=Proposition.objects.select_related("auteur")),
                Prefetch("historique", queryset=ChangementEtat.objects.order_by("cree_le", "id"))))


def filtrer_equipe(qs, parametres):
    """Filtres de la liste de l'équipe : ?etat= ?type= ?client= ?action_requise=1."""
    etat = parametres.get("etat", "").strip()
    if etat in Etat.values:
        qs = qs.filter(etat=etat)
    type_batiment = parametres.get("type", "").strip()
    if type_batiment:
        qs = qs.filter(type_batiment=type_batiment)
    client = parametres.get("client", "").strip()
    if client.isdigit():
        qs = qs.filter(client_id=int(client))
    if parametres.get("action_requise", "").strip() in ("1", "true", "vrai"):
        qs = qs.filter(action_requise=True)
    return qs


def filtrer_client(qs, parametres):
    etat = parametres.get("etat", "").strip()
    return qs.filter(etat=etat) if etat in Etat.values else qs


def resume_equipe():
    """Compteurs du tableau de bord : par étape, total, et nombre de commandes qui attendent l'équipe."""
    compteurs = {etat: 0 for etat in Etat.values}
    for ligne in Commande.objects.values("etat").annotate(n=Count("id")):
        compteurs[ligne["etat"]] = ligne["n"]
    resume = dict(compteurs)
    resume["total"] = sum(compteurs.values())
    resume["action_requise"] = commandes_equipe().filter(action_requise=True).count()
    return resume


# --- Création ---

def _verifier_droit_de_commander(utilisateur):
    """Règle 1 : un compte client actif ET une adresse complète. Vérifié côté serveur."""
    if getattr(utilisateur, "est_equipe", False):
        raise PermissionDenied({"detail": _("Un compte de l'équipe ne peut pas passer commande."),
                                "code": "compte_equipe"})
    if not peut_commander(utilisateur):
        raise PermissionDenied({"detail": _("Complétez votre adresse (ville, quartier, rue ou repère) dans votre "
                                            "profil pour passer commande."),
                                "code": "adresse_incomplete"})


def _verifier_quota(client):
    verrouiller_compte(client)  # deux envois simultanés du même client passent l'un après l'autre
    depuis = timezone.now() - timedelta(days=1)
    if Commande.objects.filter(client=client, cree_le__gte=depuis).count() >= QUOTA_COMMANDES_PAR_JOUR:
        raise Throttled(detail=_("Vous avez déjà passé %(nombre)s commandes aujourd'hui. Réessayez demain.")
                        % {"nombre": QUOTA_COMMANDES_PAR_JOUR})


def _surface(valeur):
    if valeur is None:
        return None
    valeur = Decimal(valeur)
    if valeur <= 0:
        raise ValidationError({"surface_m2": [_("La surface doit être supérieure à zéro.")]})
    return valeur


def _description(valeur):
    texte = str(valeur or "").strip()
    if len(texte) > DESCRIPTION_MAX:
        raise ValidationError({"description": [_("La description est trop longue (%(max)s caractères au plus).")
                                               % {"max": DESCRIPTION_MAX}]})
    return texte


def _lignes_demandees(client, lignes, depuis_selection):
    """Couples (produit, design) demandés, sans doublon : lignes directes puis éléments de la sélection."""
    demandes, vues = [], set()

    def ajouter(produit_id, design_id):
        if (produit_id, design_id) not in vues:
            vues.add((produit_id, design_id))
            demandes.append((produit_id, design_id))

    for ligne in lignes or []:
        ajouter(ligne["produit"], ligne.get("design"))
    if depuis_selection:
        for element in selection.elements_de(client).order_by("cree_le", "id"):
            ajouter(element.produit_id, element.design_id)
    if not demandes:
        raise ValidationError({"lignes": [_("Ajoutez au moins un produit à la commande.")]})
    if len(demandes) > LIGNES_MAX:
        raise ValidationError({"lignes": [_("Une commande compte %(max)s produits au plus.") % {"max": LIGNES_MAX}]})
    produits = {p.pk: p for p in Produit.objects.filter(pk__in={p for p, _d in demandes})}
    designs = {d.pk: d for d in Design.objects.filter(pk__in={d for _p, d in demandes if d})}
    resultat = []
    for produit_id, design_id in demandes:
        produit = produits.get(produit_id)
        if produit is None or not produit.en_ligne:
            raise ValidationError({"lignes": [_("Un des produits n'est pas disponible : retirez-le de la commande.")]})
        design = designs.get(design_id) if design_id else None
        if design_id and (design is None or design.produit_id != produit.pk):
            raise ValidationError({"lignes": [_("Un des designs n'appartient pas au produit choisi.")]})
        resultat.append((produit, design))
    return resultat


@transaction.atomic
def creer_commande(client, donnees):
    """BF-10 : crée une commande « Nouvelle » avec l'adresse du client copiée (instantané).

    `donnees` : type_batiment, surface_m2?, description?, lignes?, depuis_selection?. Si les lignes viennent de la
    sélection, celle-ci est vidée dans la même transaction.
    """
    _verifier_droit_de_commander(client)
    _verifier_quota(client)
    surface = _surface(donnees.get("surface_m2"))
    description = _description(donnees.get("description"))
    depuis_selection = bool(donnees.get("depuis_selection"))
    couples = _lignes_demandees(client, donnees.get("lignes"), depuis_selection)
    commande = Commande.objects.create(
        client=client, type_batiment=donnees["type_batiment"], surface_m2=surface, description=description,
        ville=_texte(client.ville), quartier=_texte(client.quartier), rue_ou_repere=_texte(client.rue_ou_repere))
    LigneCommande.objects.bulk_create([
        LigneCommande(commande=commande, produit=produit, design=design, produit_nom=produit.nom,
                      produit_reference=produit.reference, design_nom=design.nom if design else "")
        for produit, design in couples])
    if depuis_selection:
        selection.vider(client)
    return commande


# --- Modification ---

def modifier_par_client(commande, donnees):
    """Le client corrige surface et description, seulement tant que la commande est « Nouvelle »."""
    if commande.etat != Etat.NOUVELLE:
        raise ValidationError({"detail": _("La commande ne peut plus être modifiée : elle est déjà en négociation.")})
    champs = []
    if "surface_m2" in donnees:
        commande.surface_m2 = _surface(donnees["surface_m2"])
        champs.append("surface_m2")
    if "description" in donnees:
        commande.description = _description(donnees["description"])
        champs.append("description")
    if champs:
        commande.save(update_fields=champs + ["modifie_le"])
    return commande


def modifier_par_equipe(commande, donnees):
    """L'équipe : surface tant que la commande n'est pas « Contrat signé » ou au-delà ; notes toujours."""
    champs = []
    if "surface_m2" in donnees:
        if commande.etat not in ETATS_NEGOCIABLES:
            raise ValidationError({"surface_m2": [_("La surface ne peut plus être modifiée une fois le contrat "
                                                    "signé.")]})
        commande.surface_m2 = _surface(donnees["surface_m2"])
        champs.append("surface_m2")
    if "notes_internes" in donnees:
        commande.notes_internes = str(donnees["notes_internes"] or "").strip()
        champs.append("notes_internes")
    if champs:
        commande.save(update_fields=champs + ["modifie_le"])
    return commande


# --- Étapes ---

@transaction.atomic
def annuler(commande, utilisateur, role, motif=""):
    """Annule la commande (règle 3) ; la proposition en attente est refusée, le devis lié suit."""
    commande = negociation.verrouiller(commande)
    changer_etat(commande, Etat.ANNULEE, role=role, auteur=utilisateur, motif=motif)
    negociation.refuser_en_attente(commande)
    return commande


@transaction.atomic
def changer_etat_equipe(commande, vers, utilisateur, motif=""):
    """Étape posée à la main par l'équipe : travaux, terminée ou annulée (jamais négociation ni contrat signé)."""
    if vers == Etat.ANNULEE:
        return annuler(commande, utilisateur, EQUIPE, motif)
    commande = negociation.verrouiller(commande)
    return changer_etat(commande, vers, role=EQUIPE, auteur=utilisateur, motif=motif)


# --- Négociation (voir negociation.py) ---

def proposer(commande, utilisateur, role, donnees):
    return negociation.proposer(commande, utilisateur, role, donnees)


def repondre(proposition, utilisateur, role, accepter, message=""):
    fonction = negociation.accepter if accepter else negociation.refuser
    return fonction(proposition, utilisateur, role, message)
