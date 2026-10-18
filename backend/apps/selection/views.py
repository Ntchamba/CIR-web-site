"""API client de la sélection (/api/selection/)."""
from rest_framework import status, viewsets
from rest_framework.response import Response

from . import services
from .permissions import EstClient
from .serializers import AjoutSerializer, ElementSerializer


class SelectionViewSet(viewsets.GenericViewSet):
    """Liste (50 éléments au plus, sans pagination), résumé, ajout, retrait d'un élément, vidage."""

    permission_classes = [EstClient]
    serializer_class = ElementSerializer
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        return services.elements_de(self.request.user)

    def list(self, request):
        elements = list(self.get_queryset())
        return Response({"count": len(elements), "elements": self.get_serializer(elements, many=True).data})

    def create(self, request):
        donnees = AjoutSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        element, cree = services.ajouter(request.user, donnees.validated_data["produit"],
                                         donnees.validated_data["design"])
        element = self.get_queryset().get(pk=element.pk)
        return Response(self.get_serializer(element).data,
                        status=status.HTTP_201_CREATED if cree else status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        services.retirer(request.user, self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    def vider(self, request):
        services.vider(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def resume(self, request):
        ids = services.ids_produits(request.user)
        return Response({"count": len(ids), "produits": ids})
