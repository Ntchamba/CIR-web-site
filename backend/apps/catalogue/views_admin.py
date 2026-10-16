"""API équipe du catalogue (/api/admin/catalogue/) : familles, produits, images et designs."""
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.noyau.permissions import EstEquipe

from . import services
from .filtres import ProduitAdminFiltre
from .models import Design, ImageProduit
from .serializers import DesignAdminSerializer, FamilleAdminSerializer, ImageProduitAdminSerializer, \
    ProduitAdminSerializer


class FamilleAdminViewSet(viewsets.ModelViewSet):
    serializer_class = FamilleAdminSerializer
    permission_classes = [EstEquipe]
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        return services.familles_equipe()

    def perform_destroy(self, instance):
        services.supprimer_famille(instance)


class ProduitAdminViewSet(viewsets.ModelViewSet):
    serializer_class = ProduitAdminSerializer
    permission_classes = [EstEquipe]
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProduitAdminFiltre

    def get_queryset(self):
        return services.produits_equipe()

    def perform_destroy(self, instance):
        services.supprimer_produit(instance)

    def _ajouter(self, request, classe):
        produit = self.get_object()
        serializer = classe(data=request.data, context={**self.get_serializer_context(), "produit": produit})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def images(self, request, pk=None):
        """Ajoute une image (multipart : image, alt?, traductions?)."""
        return self._ajouter(request, ImageProduitAdminSerializer)

    @action(detail=True, methods=["post"])
    def designs(self, request, pk=None):
        """Ajoute un design (multipart : nom, image?, couleur?, traductions?)."""
        return self._ajouter(request, DesignAdminSerializer)


class _ElementProduitViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                             viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    filter_backends = []

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True  # PUT comme PATCH
        return super().update(request, *args, **kwargs)


class ImageProduitAdminViewSet(_ElementProduitViewSet):
    """images/<id>/ : PATCH (alt, ordre, traductions), DELETE."""

    serializer_class = ImageProduitAdminSerializer
    queryset = ImageProduit.objects.all()

    def perform_destroy(self, instance):
        services.supprimer_image(instance)


class DesignAdminViewSet(_ElementProduitViewSet):
    """designs/<id>/ : PATCH (multipart possible), DELETE."""

    serializer_class = DesignAdminSerializer
    queryset = Design.objects.all()

    def perform_destroy(self, instance):
        services.supprimer_design(instance)
