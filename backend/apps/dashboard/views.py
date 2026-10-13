"""Chiffres de la page d'accueil du tableau de bord."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.contact.models import DemandeContact
from apps.core.permissions import EstEquipe
from apps.orders.models import Commande, HistoriqueStatut, LigneCommande, Statut

MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]


def _debut_periode(periode):
    maintenant = timezone.localtime()
    if periode == "7j":
        return maintenant - timedelta(days=7)
    if periode == "12m":
        return maintenant - timedelta(days=365)
    return maintenant.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@api_view(["GET"])
@permission_classes([EstEquipe])
def statistiques(request):
    periode = request.query_params.get("periode", "mois")
    debut = _debut_periode(periode)
    commandes = Commande.objects.filter(cree_le__gte=debut)
    signees = HistoriqueStatut.objects.filter(nouveau=Statut.CONTRAT_SIGNE, cree_le__gte=debut)
    montant = Commande.objects.filter(pk__in=signees.values("commande")).aggregate(t=Sum("montant_convenu"))["t"]
    clients = get_user_model().objects.filter(is_staff=False, date_joined__gte=debut)

    # Commandes des 12 derniers mois (graphique)
    il_y_a_un_an = (timezone.localtime().replace(day=1) - timedelta(days=330)).replace(day=1)
    par_mois = dict(
        Commande.objects.filter(cree_le__gte=il_y_a_un_an).annotate(m=TruncMonth("cree_le"))
        .values_list("m").annotate(n=Count("id")))
    serie, curseur = [], il_y_a_un_an
    for _ in range(12):
        n = next((v for k, v in par_mois.items() if k and k.year == curseur.year and k.month == curseur.month), 0)
        serie.append({"mois": MOIS[curseur.month - 1], "annee": curseur.year, "commandes": n})
        curseur = (curseur + timedelta(days=32)).replace(day=1)

    repartition = list(commandes.values("type_batiment").annotate(n=Count("id")).order_by("-n"))
    total = sum(r["n"] for r in repartition) or 1
    produits = (LigneCommande.objects.filter(commande__cree_le__gte=debut)
                .values("produit__nom", "produit__slug").annotate(n=Count("id")).order_by("-n")[:5])

    return Response({
        "periode": periode,
        "commandes": commandes.count(),
        "negociations": Commande.objects.filter(statut=Statut.NEGOCIATION).count(),
        "contrats_signes": signees.count(),
        "montant_signe": montant or 0,
        "nouveaux_clients": clients.count(),
        "nouveaux_clients_par_type": dict(clients.values_list("type_client").annotate(n=Count("id"))),
        "demandes_sur_mesure": DemandeContact.objects.filter(objet="sur_mesure", traitee=False).count()
        + Commande.objects.filter(sur_mesure=True, statut=Statut.NOUVELLE).count(),
        "surface_commandee": LigneCommande.objects.filter(commande__cree_le__gte=debut)
        .aggregate(s=Sum("surface_m2"))["s"] or 0,
        "par_mois": serie,
        "repartition": [{"type": r["type_batiment"], "n": r["n"], "pourcentage": round(100 * r["n"] / total)}
                        for r in repartition],
        "produits_populaires": [{"nom": p["produit__nom"], "slug": p["produit__slug"], "n": p["n"]}
                                for p in produits],
    })
