"""API publique du catalogue (/api/catalogue/) : familles, produits en ligne, fiche produit."""
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from . import services
from .filtres import ProduitPublicFiltre
from .serializers import FamillePublicSerializer, ProduitCarteSerializer, ProduitDetailSerializer


class FamilleViewSet(viewsets.ReadOnlyModelViewSet):
    """Familles avec le nombre de produits en ligne (tableau simple, sans pagination)."""

    serializer_class = FamillePublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # lecture publique : un jeton périmé ne doit pas bloquer (401)
    pagination_class = None
    filter_backends = []
    lookup_field = "slug"

    def get_queryset(self):
        return services.familles_publiques()


class ProduitViewSet(viewsets.ReadOnlyModelViewSet):
    """Produits en ligne : liste paginée filtrable (BF-01, BF-14), fiche détaillée (BF-06). 404 si hors ligne."""

    permission_classes = [AllowAny]
    authentication_classes = []
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProduitPublicFiltre
    lookup_field = "slug"

    def get_queryset(self):
        return services.produit_public_detail() if self.action == "retrieve" else services.produits_publics()

    def get_serializer_class(self):
        return ProduitDetailSerializer if self.action == "retrieve" else ProduitCarteSerializer
