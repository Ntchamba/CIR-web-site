from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.catalog.models import Produit
from apps.catalog.serializers import ProduitListeSerializer

from .models import ElementSelection


class ElementSelectionSerializer(serializers.ModelSerializer):
    produit_detail = ProduitListeSerializer(source="produit", read_only=True)
    produit = serializers.SlugRelatedField(slug_field="slug", queryset=Produit.objects.filter(en_ligne=True))

    class Meta:
        model = ElementSelection
        fields = ["id", "produit", "produit_detail", "surface_m2", "remarque", "ajoute_le"]


class SelectionView(viewsets.ModelViewSet):
    """BF-09 : sélection du client connecté. Un produit n'y figure qu'une fois."""

    serializer_class = ElementSelectionSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (ElementSelection.objects.filter(client=self.request.user)
                .select_related("produit__famille").prefetch_related("produit__images"))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        element, cree = ElementSelection.objects.update_or_create(
            client=request.user, produit=serializer.validated_data["produit"],
            defaults={k: v for k, v in serializer.validated_data.items() if k != "produit"},
        )
        return Response(self.get_serializer(element).data,
                        status=status.HTTP_201_CREATED if cree else status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def fusionner(self, request):
        """Ajoute la sélection faite avant la connexion (liste de slugs gardée dans le navigateur)."""
        slugs = request.data.get("produits", [])
        for produit in Produit.objects.filter(slug__in=slugs, en_ligne=True):
            ElementSelection.objects.get_or_create(client=request.user, produit=produit)
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=False, methods=["delete"])
    def vider(self, request):
        self.get_queryset().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
