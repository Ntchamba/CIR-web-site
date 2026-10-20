"""Indicateurs du tableau de bord (BF-16), calculés à la lecture à partir des tables existantes.

Pas de table de plus. Requêtes agrégées côté base (jamais de boucle par commande), mises en cache 60 secondes par
période, jamais de donnée personnelle. Fuseau horaire : `Africa/Douala` (réglage `TIME_ZONE`).

Définitions (les chiffres d'une période portent sur les commandes **créées** pendant cette période, sauf mention) :
- `commandes.total`, `par_etape`, `par_type_batiment`, `nouvelles` : commandes créées dans la période (`par_etape` donne
  leur étape actuelle ; `nouvelles` = celles qui sont encore à l'étape « Nouvelle ») ;
- `signees` : parmi elles, celles dont le contrat a été signé (même si elles ont avancé depuis) ;
  `taux_signature` = signées / total (null sans commande) ; `delai_moyen_signature_jours` : moyenne création → signature ;
- `a_traiter` : état actuel, indépendant de la période ;
- `montants` (super-administrateur seulement) : `chiffre_convenu` et `panier_moyen` sur les contrats **signés dans la
  période** (étapes Contrat signé, Travaux, Terminée), `encaisse` et `nombre_paiements` sur les paiements **réussis dans
  la période**, `reste_a_encaisser` : solde actuel de tous les contrats signés non soldés.
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.cache import cache
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.appels.models import Appel, EtatAppel
from apps.commandes import reglement
from apps.commandes.etapes import Etat
from apps.commandes.models import Commande, EtatProposition, LigneCommande, Proposition, TypeBatiment
from apps.contact.models import DemandeContact, EtatContact
from apps.devis.models import Devis, DemandeRendu, EtatDemande, EtatDevis
from apps.messagerie.models import Message, RoleAuteur
from apps.paiements.models import EtatPaiement, Paiement

DUREE_CACHE = 60  # secondes
PERIODE_DEFAUT_JOURS = 30
PERIODE_MAX_JOURS = 366
MOIS_MAX = 24
MOIS_DEFAUT = 12
TOP_PRODUITS = 5


def fuseau():
    return ZoneInfo(settings.TIME_ZONE)


# --- Période ---

def _date(champ, texte):
    texte = str(texte).strip()
    try:
        if len(texte) != 10:
            raise ValueError
        return date.fromisoformat(texte)
    except ValueError:
        raise ValidationError({champ: [_("Date invalide : utilisez le format AAAA-MM-JJ.")]}) from None


def resoudre_periode(du=None, au=None):
    """(du, au) en dates locales, inclusives. Par défaut : les 30 derniers jours. 400 si invalide ou trop longue."""
    aujourd_hui = timezone.localdate()
    fin = _date("au", au) if au else None
    debut = _date("du", du) if du else None
    if fin is None:
        fin = aujourd_hui if debut is None or debut <= aujourd_hui else debut
    if debut is None:
        debut = fin - timedelta(days=PERIODE_DEFAUT_JOURS - 1)
    if debut > fin:
        raise ValidationError({"du": [_("La date de début doit précéder la date de fin.")]})
    if (fin - debut).days + 1 > PERIODE_MAX_JOURS:
        raise ValidationError({"du": [_("La période ne peut pas dépasser %(jours)s jours.")
                                      % {"jours": PERIODE_MAX_JOURS}]})
    return debut, fin


def bornes(debut, fin):
    """Bornes en datetimes (début inclus, fin exclue) à minuit heure de Douala."""
    tz = fuseau()
    return (datetime.combine(debut, time.min, tzinfo=tz), datetime.combine(fin + timedelta(days=1), time.min, tzinfo=tz))


# --- Résumé ---

def _commandes(debut_dt, fin_dt):
    cohorte = Commande.objects.filter(cree_le__gte=debut_dt, cree_le__lt=fin_dt)
    signe = Q(signe_le__isnull=False)
    mesures = {"total": Count("id"), "signees": Count("id", filter=signe),
               "delai": Avg(ExpressionWrapper(F("signe_le") - F("cree_le"), output_field=DurationField()),
                            filter=signe)}
    for etat in Etat.values:
        mesures[f"etat_{etat}"] = Count("id", filter=Q(etat=etat))
    for type_batiment in TypeBatiment.values:
        mesures[f"type_{type_batiment}"] = Count("id", filter=Q(type_batiment=type_batiment))
    ligne = cohorte.aggregate(**mesures)
    total, signees, delai = ligne["total"], ligne["signees"], ligne["delai"]
    return {
        "total": total,
        "par_etape": {etat: ligne[f"etat_{etat}"] for etat in Etat.values},
        "par_type_batiment": {t: ligne[f"type_{t}"] for t in TypeBatiment.values},
        "nouvelles": ligne[f"etat_{Etat.NOUVELLE}"],
        "signees": signees,
        "taux_signature": round(signees / total, 4) if total else None,
        "delai_moyen_signature_jours": round(delai.total_seconds() / 86400, 1) if delai is not None else None,
    }


def _a_traiter():
    return {
        "commandes_nouvelles": Commande.objects.filter(etat=Etat.NOUVELLE).count(),
        "propositions_en_attente_equipe": Proposition.objects.filter(
            etat=EtatProposition.EN_ATTENTE, auteur_role="client", commande__etat=Etat.NEGOCIATION).count(),
        "devis_a_envoyer": Devis.objects.filter(etat=EtatDevis.BROUILLON).count(),
        "demandes_rendu": DemandeRendu.objects.filter(etat=EtatDemande.NOUVELLE).count(),
        "demandes_contact": DemandeContact.objects.filter(etat=EtatContact.NOUVELLE).count(),
        "messages_non_lus": Message.objects.filter(auteur_role=RoleAuteur.CLIENT, lu_le__isnull=True).count(),
        "appels_manques": Appel.objects.filter(etat=EtatAppel.MANQUE, manque_vu=False).count(),
        "paiements_anomalies": Paiement.objects.filter(etat=EtatPaiement.ANOMALIE).count(),
    }


def _montants(debut_dt, fin_dt):
    signes = Commande.objects.filter(signe_le__gte=debut_dt, signe_le__lt=fin_dt, etat__in=reglement.ETATS_PAIEMENT,
                                     montant_convenu__isnull=False).aggregate(
        chiffre=Sum("montant_convenu"), nombre=Count("id"))
    paiements = Paiement.objects.filter(etat=EtatPaiement.REUSSI, termine_le__gte=debut_dt,
                                        termine_le__lt=fin_dt).aggregate(encaisse=Sum("montant"), nombre=Count("id"))
    reste = Commande.objects.filter(etat__in=reglement.ETATS_PAIEMENT, montant_convenu__gt=F("montant_paye")
                                    ).aggregate(reste=Sum(F("montant_convenu") - F("montant_paye")))["reste"]
    chiffre = signes["chiffre"] or 0
    return {"chiffre_convenu": chiffre, "encaisse": paiements["encaisse"] or 0, "reste_a_encaisser": reste or 0,
            "nombre_paiements": paiements["nombre"],
            "panier_moyen": chiffre // signes["nombre"] if signes["nombre"] else None}


def _top_produits(debut_dt, fin_dt):
    lignes = (LigneCommande.objects.filter(commande__cree_le__gte=debut_dt, commande__cree_le__lt=fin_dt)
              .exclude(produit_nom="").values("produit_nom", "produit_reference")
              .annotate(commandes=Count("commande", distinct=True)).order_by("-commandes", "produit_nom")
              [:TOP_PRODUITS])
    return list(lignes)


def resume(debut, fin, avec_montants):
    """Résumé de la période [debut, fin] (dates locales inclusives). Mis en cache 60 secondes."""
    cle = f"stats:resume:{debut}:{fin}:{int(avec_montants)}"
    resultat = cache.get(cle)
    if resultat is not None:
        return resultat
    debut_dt, fin_dt = bornes(debut, fin)
    resultat = {
        "periode": {"du": debut.isoformat(), "au": fin.isoformat()},
        "commandes": _commandes(debut_dt, fin_dt),
        "a_traiter": _a_traiter(),
        "montants": _montants(debut_dt, fin_dt) if avec_montants else None,
        "top_produits": _top_produits(debut_dt, fin_dt),
    }
    cache.set(cle, resultat, DUREE_CACHE)
    return resultat


# --- Évolution mensuelle ---

def resoudre_mois(valeur=None):
    if valeur in (None, ""):
        return MOIS_DEFAUT
    texte = str(valeur).strip()
    if not texte.isdigit() or not 1 <= int(texte) <= MOIS_MAX:
        raise ValidationError({"mois": [_("Le nombre de mois doit être compris entre 1 et %(max)s.")
                                        % {"max": MOIS_MAX}]})
    return int(texte)


def _liste_mois(nombre):
    aujourd_hui = timezone.localdate()
    annee, mois = aujourd_hui.year, aujourd_hui.month
    resultat = []
    for _i in range(nombre):
        resultat.append((annee, mois))
        mois -= 1
        if mois == 0:
            annee, mois = annee - 1, 12
    return resultat[::-1]


def evolution(nombre, avec_montants):
    """Les `nombre` derniers mois (le mois courant compris), du plus ancien au plus récent, tous présents."""
    cle = f"stats:evolution:{nombre}:{int(avec_montants)}"
    resultat = cache.get(cle)
    if resultat is not None:
        return resultat
    mois = _liste_mois(nombre)
    tz = fuseau()
    debut_dt = datetime(mois[0][0], mois[0][1], 1, tzinfo=tz)
    commandes = {}
    lignes = (Commande.objects.filter(cree_le__gte=debut_dt).annotate(m=TruncMonth("cree_le", tzinfo=tz)).values("m")
              .annotate(commandes=Count("id"), signees=Count("id", filter=Q(signe_le__isnull=False))))
    for ligne in lignes:
        commandes[(ligne["m"].year, ligne["m"].month)] = (ligne["commandes"], ligne["signees"])
    encaisse = {}
    if avec_montants:
        sommes = (Paiement.objects.filter(etat=EtatPaiement.REUSSI, termine_le__gte=debut_dt)
                  .annotate(m=TruncMonth("termine_le", tzinfo=tz)).values("m").annotate(s=Sum("montant")))
        encaisse = {(ligne["m"].year, ligne["m"].month): ligne["s"] or 0 for ligne in sommes}
    resultat = {"mois": [{
        "mois": f"{a}-{m:02d}",
        "commandes": commandes.get((a, m), (0, 0))[0],
        "signees": commandes.get((a, m), (0, 0))[1],
        "encaisse": encaisse.get((a, m), 0) if avec_montants else None,
    } for a, m in mois]}
    cache.set(cle, resultat, DUREE_CACHE)
    return resultat
