"""Règles métier des paiements. Les vues, le webhook et la commande `reverifier_paiements` ne font qu'appeler ces fonctions.

Règle d'or : une commande n'est **payée** qu'après revérification de la transaction auprès de CamPay. Le contenu
d'un webhook, d'une redirection ou d'une requête du navigateur ne prouve rien : il déclenche seulement `verifier`.

Idempotence : `_appliquer` verrouille la commande puis le paiement (toujours dans cet ordre, pour éviter les
interblocages) avant de décider. Un paiement déjà encaissé n'est jamais encaissé une seconde fois, même si deux
webhooks et la vérification du navigateur arrivent en même temps. (SQLite ignore les verrous ; PostgreSQL les respecte.)
Seul ce module écrit `Commande.montant_paye`.
"""
import logging
import re
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone, translation
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.fields import DateTimeField

from apps.commandes import reglement
from apps.commandes.models import Commande
from apps.noyau import direct
from apps.noyau.erreurs import conflit, indisponible, trop_de_demandes
from apps.noyau.langues import code_django
from apps.noyau.montants import MONTANT_MAX
from apps.noyau.verrous import verrouiller_compte

from . import signals, transactions
from .models import EtatPaiement, ModeManuel, ModePaiement, Paiement, RaisonPaiement

journal = logging.getLogger("cir.paiements")

QUOTA_PAR_HEURE = 5
DELAI_VERIFICATION_NAVIGATEUR = 3  # secondes entre deux revérifications d'un même paiement (lecture du client)
DELAI_VERIFICATION_WORKER = 5  # secondes (commande reverifier_paiements)
DELAI_VERIFICATION_EQUIPE = 3
LOT_WORKER = 100
EMETTEUR = {"nom": "Complexe Industriel Révélation SARL", "ville": "Douala"}  # noms propres : jamais traduits

ETATS_NON_MODIFIABLES = (EtatPaiement.REUSSI, EtatPaiement.ECHOUE)


# --- Mise en forme (aussi utilisée pour les trames en direct) ---

def _date(valeur):
    return DateTimeField().to_representation(valeur) if valeur else None


def avec_relations(qs):
    return qs.select_related("commande", "client", "saisi_par")


def peut_annuler(paiement):
    return paiement.mode == ModePaiement.LIEN and paiement.etat == EtatPaiement.EN_ATTENTE


def paiement_en_dict(paiement, equipe=False):
    """<Paiement> du contrat (ou <PaiementEquipe> si `equipe`), libellés dans la langue active.

    Jamais de clé, de numéro complet ni de référence interne CamPay côté client.
    """
    commande = paiement.commande
    donnees = {
        "id": paiement.pk,
        "reference": paiement.reference,
        "commande": {"id": commande.pk, "reference": commande.reference},
        "montant": paiement.montant,
        "devise": paiement.devise,
        "mode": paiement.mode,
        "mode_libelle": str(ModePaiement(paiement.mode).label),
        "etat": paiement.etat,
        "etat_libelle": str(EtatPaiement(paiement.etat).label),
        "operateur": paiement.operateur or None,
        "telephone_masque": transactions.masquer_telephone(paiement.telephone),
        "code_ussd": paiement.code_ussd or None,
        "lien": (paiement.lien or None) if paiement.etat == EtatPaiement.EN_ATTENTE else None,
        "raison": paiement.raison or None,
        "raison_libelle": str(RaisonPaiement(paiement.raison).label) if paiement.raison else None,
        "cree_le": _date(paiement.cree_le),
        "termine_le": _date(paiement.termine_le),
        "peut_annuler": peut_annuler(paiement),
    }
    if equipe:
        saisi = paiement.saisi_par
        donnees.update({
            "client": {"id": paiement.client_id, "nom_complet": paiement.client.nom_complet},
            "reference_campay": paiement.reference_campay or None,
            "reference_operateur": paiement.reference_operateur or None,
            "saisi_par": {"id": saisi.pk, "nom_complet": saisi.nom_complet} if saisi else None,
            "mode_manuel": paiement.mode_manuel or None,
            "mode_manuel_libelle": str(ModeManuel(paiement.mode_manuel).label) if paiement.mode_manuel else None,
            "note": paiement.note,
            "derniere_verification_le": _date(paiement.derniere_verification_le),
        })
    return donnees


def _publier(paiement):
    """Prévient en direct le client (dans sa langue) et l'équipe."""
    paiement = avec_relations(Paiement.objects).get(pk=paiement.pk)
    with translation.override(code_django(paiement.client.langue)):
        direct.publier_utilisateur(paiement.client_id, "paiement_mis_a_jour", {"paiement": paiement_en_dict(paiement)})
    with translation.override("fr"):
        direct.publier_equipe("paiement_mis_a_jour", {"paiement": paiement_en_dict(paiement, equipe=True)})


def recu(client, pk):
    """Reçu d'un paiement réussi du client (404 sinon)."""
    paiement = paiement_du_client(client, pk)
    if paiement.etat != EtatPaiement.REUSSI:
        raise NotFound(_("Paiement introuvable."))
    commande = paiement.commande
    return {"paiement": paiement_en_dict(paiement),
            "commande": {"id": commande.pk, "reference": commande.reference},
            "client": {"nom_complet": paiement.client.nom_complet},
            "emetteur": dict(EMETTEUR),
            "montant_paye_total": commande.montant_paye,
            "reste_a_payer": reglement.reste_a_payer(commande)}


# --- Lecture ---

def disponibilite():
    return {"configure": bool(transactions.configure()), "montant_minimum": settings.PAIEMENT_MONTANT_MINIMUM,
            "expiration_minutes": settings.PAIEMENT_EXPIRATION_MINUTES}


def _filtrer(qs, parametres):
    etat = parametres.get("etat", "").strip()
    if etat in EtatPaiement.values:
        qs = qs.filter(etat=etat)
    commande = parametres.get("commande", "").strip()
    if commande.isdigit() and int(commande) <= MONTANT_MAX:
        qs = qs.filter(commande_id=int(commande))
    return qs


def paiements_du_client(client, parametres=None):
    return _filtrer(avec_relations(Paiement.objects.filter(client=client)), parametres or {}).order_by("-cree_le", "-id")


def paiement_du_client(client, pk):
    """Un paiement du client ; celui d'un autre est introuvable (404)."""
    paiement = avec_relations(Paiement.objects).filter(pk=pk, client=client).first()
    if paiement is None:
        raise NotFound(_("Paiement introuvable."))
    return paiement


def lire_pour_client(client, pk):
    """Paiement du client ; s'il est en attente, il est revérifié auprès de CamPay (au plus une fois toutes les 3 s)."""
    paiement = paiement_du_client(client, pk)
    if paiement.etat == EtatPaiement.EN_ATTENTE:
        verifier(paiement, delai_min=DELAI_VERIFICATION_NAVIGATEUR)
        paiement = paiement_du_client(client, pk)
    return paiement


def paiements_equipe(parametres):
    """Liste de l'équipe : `?etat=` `?mode=` `?commande=` `?search=`."""
    qs = _filtrer(avec_relations(Paiement.objects.all()), parametres)
    mode = parametres.get("mode", "").strip()
    if mode in ModePaiement.values:
        qs = qs.filter(mode=mode)
    recherche = parametres.get("search", "").strip()
    if recherche:
        qs = qs.filter(Q(reference__icontains=recherche) | Q(commande__reference__icontains=recherche)
                       | Q(client__nom_complet__icontains=recherche) | Q(client__email__icontains=recherche))
    return qs.order_by("-cree_le", "-id")


def paiement_pour_equipe(pk):
    paiement = avec_relations(Paiement.objects).filter(pk=pk).first()
    if paiement is None:
        raise NotFound(_("Paiement introuvable."))
    return paiement


def _debut_du_mois(maintenant=None):
    maintenant = timezone.localtime(maintenant or timezone.now())
    return maintenant.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def resume_equipe(utilisateur):
    """`{en_attente, anomalies, encaisse_mois}` ; la somme n'est donnée qu'au super-administrateur."""
    encaisse = None
    if getattr(utilisateur, "est_super_admin", False):
        total = Paiement.objects.filter(etat=EtatPaiement.REUSSI, termine_le__gte=_debut_du_mois()).aggregate(
            s=Sum("montant"))["s"]
        encaisse = total or 0
    return {"en_attente": Paiement.objects.filter(etat=EtatPaiement.EN_ATTENTE).count(),
            "anomalies": Paiement.objects.filter(etat=EtatPaiement.ANOMALIE).count(),
            "encaisse_mois": encaisse}


# --- Encaissement (le seul endroit qui écrit Commande.montant_paye) ---

def _encaisser(commande, paiement):
    """À appeler sous le verrou de la commande et du paiement. Renvoie False si le reste à payer serait dépassé."""
    reste = reglement.reste_a_payer(commande)
    if reste is None or paiement.montant > reste:
        return False
    commande.montant_paye = (commande.montant_paye or 0) + paiement.montant
    commande.save(update_fields=["montant_paye", "modifie_le"])
    return True


def _verrouiller(pk):
    """Verrouille la commande puis le paiement (toujours dans cet ordre). Renvoie `(commande, paiement)`.

    `of=("self",)` : sur PostgreSQL, un verrou ne peut pas porter sur les tables d'un `select_related`.
    """
    commande_id = Paiement.objects.values_list("commande_id", flat=True).get(pk=pk)
    commande = Commande.objects.select_for_update(of=("self",)).get(pk=commande_id)
    paiement = avec_relations(Paiement.objects.select_for_update(of=("self",))).get(pk=pk)
    paiement.commande = commande  # l'instance verrouillée et à jour
    return commande, paiement


# --- Vérification auprès de CamPay ---

def _est_perime(paiement, maintenant):
    return maintenant - paiement.cree_le > timedelta(minutes=transactions.delai_expiration_minutes())


@transaction.atomic
def _appliquer(pk, transaction_campay, *, surveiller_annule=False):
    """Applique le résultat d'une vérification sous verrou. Renvoie le paiement à jour.

    `transaction_campay` : transaction renvoyée par CamPay, ou None si elle n'a pas pu être lue (réponse
    inexploitable : seule l'expiration locale peut alors s'appliquer).
    """
    commande, paiement = _verrouiller(pk)
    ancien = paiement.etat
    maintenant = timezone.now()
    if ancien in ETATS_NON_MODIFIABLES or (ancien == EtatPaiement.ANNULE and not surveiller_annule):
        return paiement  # déjà final : une vérification ultérieure ne le modifie jamais
    if transaction_campay is None:
        etat, raison = EtatPaiement.EN_ATTENTE, ""
    else:
        etat, raison = transactions.evaluer(paiement, transaction_campay)
        paiement.reference_operateur = transaction_campay.reference_operateur or paiement.reference_operateur
        paiement.operateur = transaction_campay.operateur or paiement.operateur
    if ancien == EtatPaiement.ANOMALIE:
        paiement.save(update_fields=["reference_operateur", "operateur"])
        return paiement  # une anomalie se règle par l'équipe, hors application

    if etat == EtatPaiement.REUSSI:
        if ancien == EtatPaiement.ANNULE:  # payé malgré l'annulation : rien n'est encaissé, l'équipe décide
            etat, raison = EtatPaiement.ANOMALIE, RaisonPaiement.INCONNUE
        elif not _encaisser(commande, paiement):  # dépassement du reste à payer (deux paiements validés ensemble)
            etat, raison = EtatPaiement.ANOMALIE, RaisonPaiement.MONTANT_DIFFERENT
    elif ancien == EtatPaiement.ANNULE:
        return paiement
    elif etat == EtatPaiement.EN_ATTENTE:
        if ancien == EtatPaiement.EN_ATTENTE and _est_perime(paiement, maintenant):
            etat, raison = EtatPaiement.EXPIRE, RaisonPaiement.EXPIRE
        else:
            paiement.save(update_fields=["reference_operateur", "operateur"])
            return paiement
    elif ancien == EtatPaiement.EXPIRE:  # expiré puis annoncé échoué : il reste expiré
        paiement.save(update_fields=["reference_operateur", "operateur"])
        return paiement

    paiement.etat, paiement.raison, paiement.termine_le = etat, str(raison), maintenant
    paiement.save(update_fields=["etat", "raison", "termine_le", "reference_operateur", "operateur"])
    _signaler(paiement)
    return paiement


def _signaler(paiement):
    if paiement.etat == EtatPaiement.REUSSI:
        signals.paiement_reussi.send(sender=Paiement, paiement=paiement)
    elif paiement.etat in (EtatPaiement.ECHOUE, EtatPaiement.EXPIRE):
        signals.paiement_echoue.send(sender=Paiement, paiement=paiement)
    elif paiement.etat == EtatPaiement.ANOMALIE:
        signals.paiement_anomalie.send(sender=Paiement, paiement=paiement)
    _publier(paiement)


def verifier(paiement, delai_min=0, surveiller_annule=False):
    """Interroge CamPay et applique le résultat (voir le contrat). Renvoie le paiement à jour.

    `delai_min` : secondes minimales depuis la dernière vérification (sinon aucun appel). Une panne de CamPay ne lève
    jamais d'erreur : le paiement reste tel quel et sera revérifié. Les règlements hors ligne ne sont jamais revérifiés.
    """
    courant = Paiement.objects.filter(pk=paiement.pk).first()
    if courant is None or courant.mode == ModePaiement.MANUEL:
        return paiement
    a_verifier = (EtatPaiement.EN_ATTENTE, EtatPaiement.EXPIRE, EtatPaiement.ANOMALIE)
    if courant.etat not in a_verifier and not (surveiller_annule and courant.etat == EtatPaiement.ANNULE):
        return courant
    maintenant = timezone.now()
    filtre = Q(pk=courant.pk)
    if delai_min:
        filtre &= Q(derniere_verification_le__isnull=True) | Q(
            derniere_verification_le__lte=maintenant - timedelta(seconds=delai_min))
    # Réservation atomique du droit d'appeler CamPay (limite le nombre d'appels, même en cas de requêtes simultanées)
    if not Paiement.objects.filter(filtre).update(derniere_verification_le=maintenant):
        return courant
    if not courant.reference_campay:  # la demande n'est pas (encore) partie chez CamPay
        return _appliquer(courant.pk, None, surveiller_annule=surveiller_annule)
    try:
        resultat = transactions.interroger(courant)
    except transactions.Indisponible:
        return courant
    except transactions.NonConfigure:
        return courant
    except transactions.Refuse:  # référence inconnue de CamPay : état inconnu, seule l'expiration peut s'appliquer
        resultat = None
    return _appliquer(courant.pk, resultat, surveiller_annule=surveiller_annule)


_REFERENCE_VALIDE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def _adopter_reference(paiement, candidate):
    """Paiement sans référence CamPay (mode lien) : adopte celle d'un webhook **seulement si CamPay la confirme**.

    La référence du webhook n'est qu'une clé de lecture non fiable. On interroge CamPay avec elle et on ne la retient
    que si la transaction renvoyée porte une `reference_externe` strictement égale à celle du paiement (aucune
    tolérance si elle est absente). Une référence déjà utilisée par un autre paiement est refusée, et un paiement
    n'adopte jamais une seconde référence. Renvoie True si la référence est adoptée.
    """
    if not _REFERENCE_VALIDE.match(candidate or "") or Paiement.objects.filter(reference_campay=candidate).exists():
        journal.warning("Référence CamPay candidate refusée pour le paiement %s.", paiement.pk)
        return False
    try:
        trouvee = transactions.interroger_reference(candidate)
    except (transactions.Indisponible, transactions.NonConfigure, transactions.Refuse):
        return False
    if not trouvee.reference_externe or trouvee.reference_externe != paiement.reference_externe:
        journal.warning("Référence CamPay candidate non confirmée pour le paiement %s : rien n'est adopté.",
                        paiement.pk)
        return False
    try:
        with transaction.atomic():
            _commande, verrouille = _verrouiller(paiement.pk)
            if verrouille.reference_campay:  # déjà adoptée (webhook simultané) : une seule adoption
                return False
            verrouille.reference_campay = candidate
            verrouille.save(update_fields=["reference_campay"])
    except IntegrityError:  # la référence a été prise entre-temps par un autre paiement
        journal.warning("Référence CamPay candidate déjà prise (paiement %s).", paiement.pk)
        return False
    return True


def traiter_webhook(evenement):
    """Webhook CamPay : retrouve le paiement (valeurs non fiables) puis le **revérifie toujours**. Renvoie le paiement ou None.

    Un paiement par lien n'a pas de référence CamPay à l'initiation : voir `_adopter_reference`.
    """
    paiement = None
    if evenement.reference_externe:
        paiement = Paiement.objects.filter(reference_externe=evenement.reference_externe).first()
    if paiement is None and evenement.reference:
        paiement = Paiement.objects.filter(reference_campay=evenement.reference).first()
    if paiement is None:
        return None
    if (not paiement.reference_campay and evenement.reference and paiement.mode == ModePaiement.LIEN
            and paiement.etat in (EtatPaiement.EN_ATTENTE, EtatPaiement.EXPIRE, EtatPaiement.ANNULE)):
        _adopter_reference(paiement, evenement.reference)
    return verifier(paiement, delai_min=0, surveiller_annule=True)


def reverifier_en_attente(limite=LOT_WORKER):
    """Commande `reverifier_paiements` : vérifie les paiements en attente (au plus un appel par paiement toutes les 5 s).

    Renvoie le nombre de paiements dont l'état a changé. Une panne ne fait jamais échouer le worker.
    """
    ordre = F("derniere_verification_le").asc(nulls_first=True)
    changes = 0
    for pk in list(Paiement.objects.filter(etat=EtatPaiement.EN_ATTENTE).exclude(mode=ModePaiement.MANUEL)
                   .order_by(ordre, "id").values_list("pk", flat=True)[:limite]):
        try:
            paiement = Paiement.objects.get(pk=pk)
            apres = verifier(paiement, delai_min=DELAI_VERIFICATION_WORKER)
            changes += apres.etat != EtatPaiement.EN_ATTENTE
        except Exception:  # noqa: BLE001 - une panne ne doit jamais arrêter le worker
            journal.exception("Vérification du paiement %s impossible.", pk)
    return changes


# --- Initiation (client) ---

def _erreur_telephone():
    return ValidationError({"telephone": [_("Saisissez un numéro de téléphone mobile camerounais valide "
                                            "(par exemple 6 99 00 11 22).")]})


def _erreur_montant(minimum, maximum):
    return ValidationError({"montant": [_("Le montant doit être compris entre %(min)s et %(max)s FCFA.")
                                        % {"min": minimum, "max": maximum}]})


def _non_autorise():
    return conflit(_("Cette commande ne peut pas être payée pour le moment : le contrat doit être signé et il doit "
                     "rester un montant à payer."), "paiement_non_autorise")


def _indisponible():
    return indisponible(_("Le paiement en ligne est momentanément indisponible. Réessayez dans quelques minutes."),
                        "paiements_indisponibles")


def _clore_en_attente(commande):
    """Un paiement en attente expiré est d'abord clos par la vérification (avant de refuser un nouveau paiement)."""
    for paiement in Paiement.objects.filter(commande=commande, etat=EtatPaiement.EN_ATTENTE):
        verifier(paiement, delai_min=DELAI_VERIFICATION_NAVIGATEUR)


def _creer_en_attente(client, commande_id, mode, numero, montant):
    with transaction.atomic():
        verrouiller_compte(client)  # deux demandes simultanées du même client passent l'une après l'autre
        commande = Commande.objects.select_for_update(of=("self",)).filter(pk=commande_id, client=client).first()
        if commande is None:
            raise NotFound(_("Commande introuvable."))
        reste = reglement.reste_a_payer(commande)
        if not reglement.paiement_applicable(commande) or not reste:
            raise _non_autorise()
        depuis = timezone.now() - timedelta(hours=1)
        lancements = Paiement.objects.filter(client=client, mode__in=[ModePaiement.MOBILE, ModePaiement.LIEN],
                                             cree_le__gte=depuis).count()
        if lancements >= QUOTA_PAR_HEURE:
            raise trop_de_demandes(_("Vous avez lancé trop de paiements : réessayez dans une heure."),
                                   "trop_de_paiements")
        if Paiement.objects.filter(commande=commande, etat=EtatPaiement.EN_ATTENTE).exists():
            raise conflit(_("Un paiement est déjà en cours pour cette commande."), "paiement_en_cours")
        minimum = min(settings.PAIEMENT_MONTANT_MINIMUM, reste)
        maximum = min(reste, MONTANT_MAX)
        montant = maximum if montant is None else montant
        if not minimum <= montant <= maximum:
            raise _erreur_montant(minimum, maximum)
        paiement = Paiement.objects.create(commande=commande, client=client, montant=montant, mode=mode,
                                           telephone=numero)
    return paiement


def initier(client, commande_id, mode=ModePaiement.MOBILE, telephone=None, montant=None):
    """Le client lance un paiement. Renvoie le paiement (201) ; voir le contrat pour les erreurs.

    Étapes : contrôles et création sous verrou, appel à CamPay **hors transaction**, puis enregistrement du résultat.
    Erreur temporaire de CamPay : le paiement est supprimé (aucun paiement créé, rien à rejouer). Erreur définitive :
    le paiement est enregistré « échoué » avec sa raison.
    """
    if not transactions.configure():
        raise indisponible(_("Le paiement en ligne n'est pas disponible pour le moment."), "paiements_non_configures")
    if mode not in (ModePaiement.MOBILE, ModePaiement.LIEN):
        raise ValidationError({"mode": [_("Choisissez Mobile Money ou le paiement par carte.")]})
    numero = ""
    if mode == ModePaiement.MOBILE:
        try:
            numero = transactions.normaliser_telephone(telephone) if telephone else ""
        except transactions.TelephoneInvalide:
            raise _erreur_telephone() from None
        if not numero:
            raise _erreur_telephone()
    if montant is not None and (isinstance(montant, bool) or not isinstance(montant, int)
                                or not 0 < montant <= MONTANT_MAX):
        raise _erreur_montant(1, MONTANT_MAX)
    commande = Commande.objects.filter(pk=commande_id, client=client).first()
    if commande is None:
        raise NotFound(_("Commande introuvable."))
    _clore_en_attente(commande)
    paiement = _creer_en_attente(client, commande.pk, mode, numero, montant)

    description = commande.reference
    try:
        if mode == ModePaiement.MOBILE:
            reference, code_ussd, operateur = transactions.lancer_mobile(paiement, description)
            lien = ""
        else:
            retour = f"{settings.SITE_URL}/commandes/{commande.pk}/payer?paiement={paiement.pk}"
            lien = transactions.lancer_lien(paiement, description, retour, retour)
            reference, code_ussd, operateur = "", "", ""
    except transactions.Refuse as refus:
        return _enregistrer_echec(paiement, refus.raison)
    except (transactions.Indisponible, transactions.NonConfigure) as erreur:
        Paiement.objects.filter(pk=paiement.pk, etat=EtatPaiement.EN_ATTENTE).delete()  # aucun paiement créé
        if isinstance(erreur, transactions.NonConfigure):
            raise indisponible(_("Le paiement en ligne n'est pas disponible pour le moment."),
                               "paiements_non_configures") from None
        raise _indisponible() from None

    try:
        with transaction.atomic():
            _commande, paiement = _verrouiller(paiement.pk)
            champs = ["reference_campay", "code_ussd", "operateur", "lien"]
            paiement.reference_campay, paiement.code_ussd, paiement.operateur, paiement.lien = (
                reference, code_ussd, operateur, lien)
            paiement.save(update_fields=champs)
            _publier(paiement)
    except IntegrityError:  # référence CamPay déjà portée par un autre paiement : on n'en partage jamais
        journal.error("Référence CamPay en double refusée (paiement %s).", paiement.pk)
        return _enregistrer_echec(paiement, RaisonPaiement.INCONNUE)
    return avec_relations(Paiement.objects).get(pk=paiement.pk)


def _enregistrer_echec(paiement, raison):
    with transaction.atomic():
        _commande, paiement = _verrouiller(paiement.pk)
        paiement.etat, paiement.raison, paiement.termine_le = EtatPaiement.ECHOUE, str(raison), timezone.now()
        paiement.save(update_fields=["etat", "raison", "termine_le"])
        _publier(paiement)
    return paiement


def annuler(client, pk):
    """Le client annule un paiement en attente par lien (un paiement mobile expire : la demande est sur le téléphone)."""
    paiement = paiement_du_client(client, pk)
    if not peut_annuler(paiement):
        raise conflit(_("Ce paiement ne peut pas être annulé."), "paiement_non_autorise")
    verifier(paiement, delai_min=0)  # s'il a été payé entre-temps, il ne s'annule pas
    with transaction.atomic():
        _commande, paiement = _verrouiller(pk)
        if not peut_annuler(paiement):
            raise conflit(_("Ce paiement ne peut pas être annulé."), "paiement_non_autorise")
        paiement.etat, paiement.termine_le = EtatPaiement.ANNULE, timezone.now()
        paiement.save(update_fields=["etat", "termine_le"])
        _publier(paiement)
    return paiement


# --- Équipe ---

def reverifier(pk):
    """Bouton « Revérifier » de l'équipe (paiements en attente, expirés ou en anomalie)."""
    paiement = paiement_pour_equipe(pk)
    if paiement.mode == ModePaiement.MANUEL or paiement.etat not in (
            EtatPaiement.EN_ATTENTE, EtatPaiement.EXPIRE, EtatPaiement.ANOMALIE):
        raise conflit(_("Ce paiement ne peut pas être revérifié."), "paiement_non_autorise")
    verifier(paiement, delai_min=DELAI_VERIFICATION_EQUIPE)
    return paiement_pour_equipe(pk)


def enregistrer_reglement(commande_id, membre, montant, mode_manuel, note=""):
    """Règlement hors ligne (espèces, virement, chèque) : créé « réussi », tracé, jamais revérifié."""
    if mode_manuel not in ModeManuel.values:
        raise ValidationError({"mode_manuel": [_("Choisissez un mode de règlement.")]})
    note = str(note or "").strip()
    if len(note) > 300:
        raise ValidationError({"note": [_("La note est trop longue (300 caractères au plus).")]})
    with transaction.atomic():
        commande = Commande.objects.select_for_update(of=("self",)).filter(pk=commande_id).first()
        if commande is None:
            raise NotFound(_("Commande introuvable."))
        reste = reglement.reste_a_payer(commande)
        if not reglement.paiement_applicable(commande) or not reste:
            raise _non_autorise()
        if isinstance(montant, bool) or not isinstance(montant, int) or not 1 <= montant <= min(reste, MONTANT_MAX):
            raise _erreur_montant(1, min(reste, MONTANT_MAX))
        paiement = Paiement.objects.create(
            commande=commande, client_id=commande.client_id, montant=montant, mode=ModePaiement.MANUEL,
            etat=EtatPaiement.REUSSI, mode_manuel=mode_manuel, note=note, saisi_par=membre,
            termine_le=timezone.now())
        _encaisser(commande, paiement)  # le reste a été vérifié sous verrou
        paiement.commande = commande
        _signaler(paiement)
    return paiement_pour_equipe(paiement.pk)
