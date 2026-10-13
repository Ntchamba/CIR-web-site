from rest_framework import generics, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import EstEquipe

from .models import ContenuAccueil, PhotoSphere


class PhotoSphereSerializer(serializers.ModelSerializer):
    produit_slug = serializers.CharField(source="produit.slug", read_only=True, default=None)

    class Meta:
        model = PhotoSphere
        fields = ["id", "image", "alt", "produit", "produit_slug", "ordre"]


class ContenuAccueilSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContenuAccueil
        fields = ["titre", "accroche", "video", "telephone", "whatsapp", "email", "adresse", "texte_partenaire"]


@api_view(["GET"])
@permission_classes([AllowAny])
def accueil(request):
    """Tout ce que l'accueil du site affiche, en un seul appel (moins d'allers-retours, BNF-02)."""
    contenu = ContenuAccueilSerializer(ContenuAccueil.charger(), context={"request": request}).data
    photos = PhotoSphereSerializer(PhotoSphere.objects.select_related("produit"), many=True,
                                   context={"request": request}).data
    return Response({**contenu, "sphere": photos})


class ContenuAccueilAdminView(generics.RetrieveUpdateAPIView):
    permission_classes = [EstEquipe]
    serializer_class = ContenuAccueilSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        return ContenuAccueil.charger()


class PhotosSphereAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = PhotoSphereSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None
    queryset = PhotoSphere.objects.select_related("produit")
