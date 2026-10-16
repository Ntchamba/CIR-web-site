"""API équipe de la vitrine (/api/admin/vitrine/) : réalisations, démonstrations, modération des témoignages."""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.noyau.permissions import EstEquipe

from . import services
from .models import Demo, Realisation, StatutTemoignage, Temoignage
from .serializers import DemoAdminSerializer, RealisationAdminSerializer, RefusSerializer, TemoignageAdminSerializer


class RealisationAdminViewSet(viewsets.ModelViewSet):
    serializer_class = RealisationAdminSerializer
    permission_classes = [EstEquipe]
    search_fields = ["titre", "ville", "description"]
    filterset_fields = ["type_chantier", "publie"]
    ordering_fields = ["ordre", "date", "cree_le"]

    def get_queryset(self):
        return Realisation.objects.prefetch_related("produits")

    def perform_destroy(self, instance):
        services.supprimer_realisation(instance)


class DemoAdminViewSet(viewsets.ModelViewSet):
    serializer_class = DemoAdminSerializer
    permission_classes = [EstEquipe]
    search_fields = ["titre", "description"]
    filterset_fields = ["publie"]
    queryset = Demo.objects.all()

    def perform_destroy(self, instance):
        services.supprimer_demo(instance)


class TemoignageAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin,
                             viewsets.GenericViewSet):
    """Modération (BF-04) : liste `?statut=en_attente|publie|refuse`, publier, refuser (motif), supprimer."""

    serializer_class = TemoignageAdminSerializer
    permission_classes = [EstEquipe]
    search_fields = ["nom_affiche", "texte", "ville"]
    ordering_fields = ["cree_le", "note"]

    def get_queryset(self):
        qs = Temoignage.objects.select_related("auteur")
        statut = self.request.query_params.get("statut", "").strip()
        return qs.filter(statut=statut) if statut in StatutTemoignage.values else qs

    def perform_destroy(self, instance):
        services.supprimer_temoignage(instance)

    @action(detail=True, methods=["post"])
    def publier(self, request, pk=None):
        temoignage = services.publier_temoignage(self.get_object(), request.user)
        return Response(self.get_serializer(temoignage).data)

    @action(detail=True, methods=["post"])
    def refuser(self, request, pk=None):
        donnees = RefusSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        temoignage = services.refuser_temoignage(self.get_object(), request.user, donnees.validated_data["motif"])
        return Response(self.get_serializer(temoignage).data)
