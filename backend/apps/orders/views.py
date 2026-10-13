from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import EstEquipe

from . import services
from .models import Commande, Proposition, Statut
from .serializers import (
    CommandeAdminSerializer,
    CommandeListeSerializer,
    CommandeSerializer,
    PropositionSerializer,
)


def _avec_relations(qs):
    return qs.select_related("client", "conversation").prefetch_related(
        "lignes__produit__images", "propositions__auteur", "historique__par")


class CommandesView(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                    viewsets.GenericViewSet):
    """BF-10, BF-12, BF-13 : commandes du client connecté."""

    lookup_field = "numero"
    filterset_fields = ["statut"]

    def get_queryset(self):
        moi = self.request.user
        non_lus = Count("conversation__messages", filter=Q(conversation__messages__lu_par_client=False)
                        & ~Q(conversation__messages__auteur=moi))
        return _avec_relations(Commande.objects.filter(client=moi)).annotate(non_lus=non_lus)

    def get_serializer_class(self):
        return CommandeListeSerializer if self.action == "list" else CommandeSerializer

    def create(self, request, *args, **kwargs):
        serializer = CommandeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        commande = services.creer_commande(request.user, dict(serializer.validated_data))
        return Response(CommandeSerializer(commande, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def propositions(self, request, numero=None):
        """Contre-proposition du client."""
        commande = self.get_object()
        serializer = PropositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.proposer(commande, request.user, dict(serializer.validated_data))
        return Response(CommandeSerializer(self.get_object(), context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"propositions/(?P<pid>\d+)/(?P<reponse>accepter|refuser)")
    def repondre(self, request, numero=None, pid=None, reponse=None):
        commande = self.get_object()
        proposition = get_object_or_404(Proposition, pk=pid, commande=commande)
        services.repondre(proposition, request.user, accepter=(reponse == "accepter"))
        return Response(CommandeSerializer(self.get_object(), context={"request": request}).data)


# --- Tableau de bord (BF-16) ---

class CommandesAdminView(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                         viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    lookup_field = "numero"
    filterset_fields = ["statut", "type_batiment", "sur_mesure", "client"]
    search_fields = ["numero", "client__nom_complet", "client__email", "ville", "lignes__produit__nom"]
    ordering_fields = ["cree_le", "modifie_le", "statut"]

    def get_queryset(self):
        non_lus = Count("conversation__messages", filter=Q(conversation__messages__lu_par_equipe=False)
                        & Q(conversation__messages__auteur__is_staff=False))
        return _avec_relations(Commande.objects.all()).annotate(non_lus=non_lus).distinct()

    def get_serializer_class(self):
        return CommandeListeSerializer if self.action == "list" else CommandeAdminSerializer

    def partial_update(self, request, *args, **kwargs):
        commande = self.get_object()
        if "note_interne" in request.data:
            commande.note_interne = request.data["note_interne"]
        if "montant_convenu" in request.data:
            commande.montant_convenu = request.data["montant_convenu"] or None
        commande.save()
        if request.data.get("statut"):
            if request.data["statut"] not in Statut.values:
                return Response({"statut": "Statut inconnu."}, status=status.HTTP_400_BAD_REQUEST)
            services.changer_statut(commande, request.data["statut"], request.user)
        return Response(CommandeAdminSerializer(self.get_queryset().get(pk=commande.pk),
                                                context={"request": request}).data)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def propositions(self, request, numero=None):
        """Proposition de prix et de délai de l'équipe."""
        commande = self.get_object()
        serializer = PropositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.proposer(commande, request.user, dict(serializer.validated_data))
        return Response(CommandeAdminSerializer(self.get_queryset().get(pk=commande.pk),
                                                context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=False)
    def compteurs(self, request):
        """Nombre de commandes par statut (filtres de la page Commandes)."""
        par_statut = dict(Commande.objects.values_list("statut").annotate(n=Count("id")))
        return Response({"toutes": sum(par_statut.values()),
                         **{s: par_statut.get(s, 0) for s in Statut.values}})
