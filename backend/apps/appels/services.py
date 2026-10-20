"""Règles métier des appels. Les vues et le webhook ne font qu'appeler ces fonctions.

Règles (contrat de la vague 3) :
- seul un **client** lance un appel ; l'équipe ne peut pas appeler un client dans cette version ;
- un seul appel actif (« sonne » ou « en cours ») par client ;
- personne de l'équipe en ligne : l'appel est refusé (409 `equipe_indisponible`) ;
- sans réponse après 60 secondes : « manqué » (calculé à partir de la base) et notification à l'équipe ;
- la première personne de l'équipe qui répond gagne (verrou de ligne) ; une seconde réponse : 409 `appel_pris`.
"""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound, ValidationError

from apps.commandes.models import Commande
from apps.noyau import direct, presence
from apps.noyau.erreurs import conflit, indisponible, trop_de_demandes
from apps.noyau.verrous import verrouiller_compte
from integrations.jaas.erreurs import JaasNonConfigure

from . import salles, signals
from .models import ETATS_ACTIFS, Appel, EtatAppel, TypeAppel

QUOTA_APPELS_PAR_HEURE = 5
PROCHE_POURCENTAGE = 80


# --- Sérialisation (aussi utilisée pour les trames en direct) ---

def appel_en_dict(appel):
    """<Appel> du contrat."""
    from rest_framework.fields import DateTimeField

    def date(valeur):
        return DateTimeField().to_representation(valeur) if valeur else None

    client, commande, repondeur = appel.client, appel.commande, appel.repondu_par
    return {
        "id": appel.pk,
        "reference": appel.reference,
        "type": appel.type,
        "etat": appel.etat,
        "client": {"id": client.pk, "nom_complet": client.nom_complet, "telephone": client.telephone},
        "commande": {"id": commande.pk, "reference": commande.reference} if commande else None,
        "cree_le": date(appel.cree_le),
        "demarre_le": date(appel.demarre_le),
        "termine_le": date(appel.termine_le),
        "repondu_par": {"id": repondeur.pk, "nom_complet": repondeur.nom_complet} if repondeur else None,
        "duree_secondes": appel.duree_secondes,
    }


def avec_relations(qs):
    return qs.select_related("client", "commande", "repondu_par")


def _publier_mise_a_jour(appel):
    """Prévient le client et l'équipe (les autres membres arrêtent leur sonnerie)."""
    appel = avec_relations(Appel.objects).get(pk=appel.pk)
    donnees = {"appel": appel_en_dict(appel)}
    direct.publier_utilisateur(appel.client_id, "appel_mis_a_jour", donnees)
    direct.publier_equipe("appel_mis_a_jour", donnees)


# --- Expiration (calculée à partir de la base) ---

def _doit_expirer(appel, maintenant):
    if appel.etat == EtatAppel.SONNE:
        return maintenant - appel.cree_le > salles.DELAI_SONNERIE
    if appel.etat == EtatAppel.EN_COURS:
        depart = appel.demarre_le or appel.cree_le
        return maintenant - depart > salles.DUREE_MAX_APPEL
    return False


@transaction.atomic
def _expirer_verrouille(pk):
    """Relit l'appel en le verrouillant et applique l'expiration. Renvoie l'appel à jour."""
    appel = avec_relations(Appel.objects.select_for_update(of=("self",))).get(pk=pk)
    maintenant = timezone.now()
    if not _doit_expirer(appel, maintenant):
        return appel
    if appel.etat == EtatAppel.SONNE:
        appel.etat = EtatAppel.MANQUE
        appel.termine_le = maintenant
        appel.save(update_fields=["etat", "termine_le"])
        signals.appel_manque.send(sender=Appel, appel=appel)
    else:  # « en cours » sans fin signalée (webhook absent)
        appel.etat = EtatAppel.TERMINE
        appel.termine_le = maintenant
        appel.save(update_fields=["etat", "termine_le"])
    _publier_mise_a_jour(appel)
    return appel


def appliquer_expiration(appel):
    """À appeler à chaque lecture d'un appel : le fait passer à « manqué » après 60 secondes sans réponse."""
    if _doit_expirer(appel, timezone.now()):
        return _expirer_verrouille(appel.pk)
    return appel


def expirer_appels():
    """Commande `expirer_appels` (et listes de l'équipe) : traite tous les appels périmés. Renvoie leur nombre."""
    maintenant = timezone.now()
    perimes = Appel.objects.filter(
        Q(etat=EtatAppel.SONNE, cree_le__lt=maintenant - salles.DELAI_SONNERIE)
        | Q(etat=EtatAppel.EN_COURS, demarre_le__lt=maintenant - salles.DUREE_MAX_APPEL)
        | Q(etat=EtatAppel.EN_COURS, demarre_le__isnull=True, cree_le__lt=maintenant - salles.DUREE_MAX_APPEL))
    nombre = 0
    for pk in list(perimes.values_list("pk", flat=True)):
        avant = Appel.objects.filter(pk=pk).values_list("etat", flat=True).first()
        apres = _expirer_verrouille(pk).etat
        nombre += avant != apres
    return nombre


# --- Client ---

def disponibilite():
    """`{configure, equipe_en_ligne}` : jamais le nombre exact de personnes en ligne."""
    return {"configure": salles.configure(), "equipe_en_ligne": presence.equipe_en_ligne() > 0}


def _commande_du_client(client, commande_id):
    if commande_id in (None, ""):
        return None
    try:
        identifiant = int(commande_id)
    except (TypeError, ValueError):
        identifiant = -1
    commande = Commande.objects.filter(pk=identifiant, client=client).first()
    if commande is None:
        raise ValidationError({"commande": [_("Commande introuvable.")]})
    return commande


def lancer(client, type_appel, commande_id=None):
    """Le client appelle l'équipe. Renvoie `(appel, jitsi)` ; `jitsi` = `{domaine, app_id, salle, jeton}` (participant)."""
    if type_appel not in TypeAppel.values:
        raise ValidationError({"type": [_("Choisissez un appel audio ou vidéo.")]})
    if not salles.configure():
        raise indisponible(_("Les appels ne sont pas disponibles pour le moment."), "appels_non_configures")
    with transaction.atomic():
        verrouiller_compte(client)  # deux demandes simultanées du même client passent l'une après l'autre
        for ancien in Appel.objects.filter(client=client, etat__in=ETATS_ACTIFS):
            appliquer_expiration(ancien)
        if Appel.objects.filter(client=client, etat__in=ETATS_ACTIFS).exists():
            raise conflit(_("Vous avez déjà un appel en cours."), "appel_deja_en_cours")
        depuis = timezone.now() - timedelta(hours=1)
        if Appel.objects.filter(client=client, cree_le__gte=depuis).count() >= QUOTA_APPELS_PAR_HEURE:
            raise trop_de_demandes(_("Vous avez lancé trop d'appels : réessayez dans une heure."), "trop_d_appels")
        commande = _commande_du_client(client, commande_id)
        if presence.equipe_en_ligne() == 0:
            raise conflit(_("Personne de l'équipe n'est disponible : écrivez-nous un message ou demandez à être "
                            "rappelé."), "equipe_indisponible")
        appel = Appel.objects.create(client=client, type=type_appel, commande=commande, salle=salles.nouvelle_salle())
        try:
            jitsi = salles.jitsi_pour(appel, client, moderateur=False)
        except JaasNonConfigure:
            raise indisponible(_("Les appels ne sont pas disponibles pour le moment."),
                               "appels_non_configures") from None
        appel = avec_relations(Appel.objects).get(pk=appel.pk)
        direct.publier_equipe("appel_entrant", {"appel": appel_en_dict(appel)})
    return appel, jitsi


def appel_du_client(client, pk):
    """Un appel du client (404 pour l'appel d'un autre), avec l'expiration appliquée."""
    appel = avec_relations(Appel.objects).filter(pk=pk, client=client).first()
    if appel is None:
        raise NotFound(_("Appel introuvable."))
    return appliquer_expiration(appel)


@transaction.atomic
def annuler(client, pk):
    """Le client raccroche pendant que ça sonne."""
    appel_du_client(client, pk)
    appel = avec_relations(Appel.objects.select_for_update(of=("self",))).get(pk=pk)
    if appel.etat != EtatAppel.SONNE:
        raise ValidationError({"detail": _("Cet appel ne peut plus être annulé.")})
    appel.etat = EtatAppel.ANNULE
    appel.termine_le = timezone.now()
    appel.save(update_fields=["etat", "termine_le"])
    _publier_mise_a_jour(appel)
    return appel


@transaction.atomic
def terminer(utilisateur, pk):
    """Fin d'un appel en cours (par le client concerné ou par un membre de l'équipe)."""
    qs = avec_relations(Appel.objects.select_for_update(of=("self",)))
    if not utilisateur.est_equipe:
        qs = qs.filter(client=utilisateur)
    appel = qs.filter(pk=pk).first()
    if appel is None:
        raise NotFound(_("Appel introuvable."))
    appel = appliquer_expiration(appel)
    if appel.etat != EtatAppel.EN_COURS:
        raise ValidationError({"detail": _("Cet appel n'est pas en cours.")})
    appel.etat = EtatAppel.TERMINE
    appel.termine_le = timezone.now()
    appel.save(update_fields=["etat", "termine_le"])
    _publier_mise_a_jour(appel)
    return appel


# --- Équipe ---

@transaction.atomic
def repondre(membre, pk):
    """La première personne de l'équipe qui répond gagne. Renvoie `(appel, jitsi)` (jeton modérateur)."""
    appel = avec_relations(Appel.objects.select_for_update(of=("self",))).filter(pk=pk).first()
    if appel is None:
        raise NotFound(_("Appel introuvable."))
    appel = appliquer_expiration(appel)
    if appel.etat == EtatAppel.EN_COURS and appel.repondu_par_id == membre.pk:
        return appel, _jitsi_equipe(appel, membre)  # la même personne rejoint à nouveau (page rechargée)
    if appel.etat != EtatAppel.SONNE:
        if appel.etat in (EtatAppel.EN_COURS, EtatAppel.TERMINE, EtatAppel.REFUSE):
            raise conflit(_("Un autre membre de l'équipe a déjà pris cet appel."), "appel_pris")
        raise conflit(_("Cet appel n'est plus disponible."), "appel_indisponible")
    jitsi = _jitsi_equipe(appel, membre)
    appel.etat = EtatAppel.EN_COURS
    appel.repondu_par = membre
    appel.demarre_le = timezone.now()
    appel.save(update_fields=["etat", "repondu_par", "demarre_le"])
    _publier_mise_a_jour(appel)
    return appel, jitsi


def _jitsi_equipe(appel, membre):
    try:
        return salles.jitsi_pour(appel, membre, moderateur=True)
    except JaasNonConfigure:
        raise indisponible(_("Les appels ne sont pas disponibles pour le moment."),
                           "appels_non_configures") from None


@transaction.atomic
def refuser(membre, pk):
    """L'équipe décline un appel qui sonne."""
    appel = avec_relations(Appel.objects.select_for_update(of=("self",))).filter(pk=pk).first()
    if appel is None:
        raise NotFound(_("Appel introuvable."))
    appel = appliquer_expiration(appel)
    if appel.etat != EtatAppel.SONNE:
        raise conflit(_("Cet appel n'est plus disponible."), "appel_indisponible")
    appel.etat = EtatAppel.REFUSE
    appel.termine_le = timezone.now()
    appel.save(update_fields=["etat", "termine_le"])
    _publier_mise_a_jour(appel)
    return appel


def en_attente():
    """Appels qui sonnent (ouverture de page, reprise après coupure)."""
    expirer_appels()
    return avec_relations(Appel.objects.filter(etat=EtatAppel.SONNE)).order_by("cree_le", "id")


def historique(parametres):
    """Historique de l'équipe : `?etat=` `?search=` ; les appels manqués **non vus** d'abord."""
    expirer_appels()
    qs = avec_relations(Appel.objects.all())
    etat = parametres.get("etat", "").strip()
    if etat in EtatAppel.values:
        qs = qs.filter(etat=etat)
    recherche = parametres.get("search", "").strip()
    if recherche:
        qs = qs.filter(Q(reference__icontains=recherche) | Q(client__nom_complet__icontains=recherche)
                       | Q(client__email__icontains=recherche) | Q(client__telephone__icontains=recherche))
    manque_d_abord = Case(When(etat=EtatAppel.MANQUE, manque_vu=False, then=Value(0)), default=Value(1),
                          output_field=IntegerField())
    return qs.order_by(manque_d_abord, "-cree_le", "-id")


def marquer_manques_vus():
    """L'équipe a ouvert la liste : les appels manqués sont « vus »."""
    return Appel.objects.filter(etat=EtatAppel.MANQUE, manque_vu=False).update(manque_vu=True)


def usage(maintenant=None):
    """Clients distincts ayant eu un appel « en cours » ou « terminé » ce mois-ci (offre gratuite : 25)."""
    maintenant = timezone.localtime(maintenant or timezone.now())
    debut = maintenant.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    fin = (debut + timedelta(days=32)).replace(day=1)
    actifs = (Appel.objects.filter(etat__in=[EtatAppel.EN_COURS, EtatAppel.TERMINE],
                                   demarre_le__gte=debut, demarre_le__lt=fin)
              .values("client").distinct().count())
    limite = settings.JAAS_LIMITE_GRATUITE
    return {"mois": f"{debut.year}-{debut.month:02d}", "utilisateurs_actifs": actifs, "limite_gratuite": limite,
            "configure": salles.configure(), "depasse": actifs > limite, "proche": actifs * 100 >= limite * PROCHE_POURCENTAGE}


def resume():
    expirer_appels()
    return {"en_attente": Appel.objects.filter(etat=EtatAppel.SONNE).count(),
            "manques_non_vus": Appel.objects.filter(etat=EtatAppel.MANQUE, manque_vu=False).count()}


# --- Webhook JaaS ---

def traiter_evenements(evenements):
    """Événements du webhook : ils ne font que confirmer l'état (jamais indispensables au fonctionnement).

    - `ROOM_DESTROYED` : l'appel « en cours » de la salle est terminé ;
    - `PARTICIPANT_JOINED` : renseigne le début de l'appel s'il manque. Il ne passe jamais un appel « qui sonne » à
      « en cours » : le client entre lui-même dans la salle pendant que ça sonne.
    """
    traites = 0
    for evenement in evenements:
        appel = avec_relations(Appel.objects).filter(salle=evenement.salle).first()
        if appel is None:
            continue
        if evenement.type == "ROOM_DESTROYED" and appel.etat == EtatAppel.EN_COURS:
            with transaction.atomic():
                appel = avec_relations(Appel.objects.select_for_update(of=("self",))).get(pk=appel.pk)
                if appel.etat == EtatAppel.EN_COURS:
                    appel.etat = EtatAppel.TERMINE
                    appel.termine_le = timezone.now()
                    appel.save(update_fields=["etat", "termine_le"])
                    _publier_mise_a_jour(appel)
                    traites += 1
        elif evenement.type == "PARTICIPANT_JOINED" and appel.etat == EtatAppel.EN_COURS and not appel.demarre_le:
            Appel.objects.filter(pk=appel.pk, demarre_le__isnull=True).update(demarre_le=timezone.now())
            traites += 1
    return traites
