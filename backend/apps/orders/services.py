"""Règles métier des commandes : création, négociation, changements d'étape."""
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.messaging.services import conversation_de_commande, message_systeme
from apps.notifications.services import notifier
from apps.selection.models import ElementSelection

from .models import Commande, HistoriqueStatut, LigneCommande, Proposition, Statut


def changer_statut(commande, nouveau, par=None):
    if commande.statut == nouveau:
        return commande
    ancien = commande.statut
    commande.statut = nouveau
    commande.save(update_fields=["statut", "modifie_le"])
    HistoriqueStatut.objects.create(commande=commande, ancien=ancien, nouveau=nouveau, par=par)
    message_systeme(commande, f"Étape : {commande.get_statut_display()}.")
    notifier("commande.statut", commande.client, {"commande": commande})
    return commande


@transaction.atomic
def creer_commande(client, donnees):
    """BF-10 et règle de gestion : adresse obligatoire ; lignes reprises de la sélection si absentes."""
    if not client.a_une_adresse:
        raise ValidationError({"adresse": "Ajoutez votre adresse dans votre compte avant de commander."})
    lignes = donnees.pop("lignes", None)
    if not lignes:
        lignes = [{"produit": e.produit, "surface_m2": e.surface_m2, "remarque": e.remarque}
                  for e in ElementSelection.objects.filter(client=client).select_related("produit")]
    if not lignes and not donnees.get("sur_mesure"):
        raise ValidationError({"lignes": "Choisissez au moins un produit, ou demandez un rendu sur mesure."})

    adresse = client.adresse
    donnees.setdefault("ville", adresse.ville)
    donnees.setdefault("quartier", adresse.quartier)
    donnees.setdefault("rue_repere", adresse.rue_repere)
    donnees.setdefault("type_batiment", client.type_client)

    commande = Commande.objects.create(client=client, **donnees)
    LigneCommande.objects.bulk_create([LigneCommande(commande=commande, **ligne) for ligne in lignes])
    HistoriqueStatut.objects.create(commande=commande, nouveau=Statut.NOUVELLE, par=client)
    ElementSelection.objects.filter(client=client).delete()
    conversation_de_commande(commande)
    notifier("commande.nouvelle", None, {"commande": commande})
    return commande


@transaction.atomic
def proposer(commande, auteur, donnees):
    """BF-12 : nouvelle proposition. Les précédentes en attente sont remplacées."""
    if commande.statut in (Statut.TERMINEE, Statut.ANNULEE):
        raise ValidationError("Cette commande est close.")
    if commande.statut in (Statut.CONTRAT_SIGNE, Statut.TRAVAUX) and not auteur.is_staff:
        raise ValidationError("Le contrat est déjà signé : contactez l'équipe par la messagerie.")
    prix, total = donnees.get("prix_m2"), donnees.get("montant_total")
    if total is None and prix is not None and commande.surface_totale:
        donnees["montant_total"] = (Decimal(prix) * Decimal(commande.surface_totale)).quantize(Decimal("1"))
    commande.propositions.filter(etat=Proposition.Etat.EN_ATTENTE).update(etat=Proposition.Etat.REMPLACEE)
    proposition = Proposition.objects.create(commande=commande, auteur=auteur, de_l_equipe=auteur.is_staff,
                                             **donnees)
    if commande.statut == Statut.NOUVELLE:
        changer_statut(commande, Statut.NEGOCIATION, auteur)
    qui = "L'équipe CIR" if auteur.is_staff else "Le client"
    message_systeme(commande, f"{qui} a fait une proposition.")
    # Destinataire : le client si l'équipe propose, l'équipe (None) si le client propose
    notifier("commande.proposition", commande.client if auteur.is_staff else None,
             {"commande": commande, "proposition": proposition})
    return proposition


@transaction.atomic
def repondre(proposition, utilisateur, accepter):
    """Le client accepte ou refuse une proposition de l'équipe (et inversement)."""
    if proposition.etat != Proposition.Etat.EN_ATTENTE:
        raise ValidationError("Cette proposition n'attend plus de réponse.")
    if proposition.de_l_equipe == utilisateur.is_staff:
        raise ValidationError("On ne répond pas à sa propre proposition.")
    commande = proposition.commande
    proposition.etat = Proposition.Etat.ACCEPTEE if accepter else Proposition.Etat.REFUSEE
    proposition.save(update_fields=["etat"])
    if accepter:
        commande.montant_convenu = proposition.montant_total
        commande.save(update_fields=["montant_convenu", "modifie_le"])
        changer_statut(commande, Statut.CONTRAT_SIGNE, utilisateur)
    else:
        message_systeme(commande, "Proposition refusée.")
    return proposition
