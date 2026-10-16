"""API publique de la vitrine (/api/vitrine/) : réalisations, démonstrations, témoignages."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import services
from .permissions import EstClientConnecte
from .serializers import (DemoPublicSerializer, RealisationPublicSerializer, TemoignageDepotSerializer,
                          TemoignageMienSerializer, TemoignagePublicSerializer)


class RealisationViewSet(viewsets.ReadOnlyModelViewSet):
    """BF-02 : réalisations publiées (`?type=<type_chantier>`) ; détail par slug."""

    serializer_class = RealisationPublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # lecture publique : un jeton périmé ne doit pas bloquer (401)
    filter_backends = []
    lookup_field = "slug"

    def get_queryset(self):
        qs = services.realisations_publiques()
        type_chantier = self.request.query_params.get("type", "").strip()
        return qs.filter(type_chantier=type_chantier) if type_chantier else qs


class DemoViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """BF-03 : démonstrations vidéo publiées."""

    serializer_class = DemoPublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    filter_backends = []

    def get_queryset(self):
        return services.demos_publiques()


class TemoignageViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """BF-04 : témoignages publiés (lecture libre) ; dépôt par un client connecté ; « mes témoignages »."""

    filter_backends = []

    def get_permissions(self):
        if self.action == "create":
            return [EstClientConnecte()]
        if self.action == "miens":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        if self.action == "miens":
            return services.temoignages_de(self.request.user)
        return services.temoignages_publics()

    def get_serializer_class(self):
        if self.action == "create":
            return TemoignageDepotSerializer
        if self.action == "miens":
            return TemoignageMienSerializer
        return TemoignagePublicSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def miens(self, request):
        return self.list(request)
