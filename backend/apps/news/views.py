from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny

from apps.core.permissions import EstEquipe

from .models import Nouveaute


class NouveauteSerializer(serializers.ModelSerializer):
    produit_slug = serializers.CharField(source="produit.slug", read_only=True, default=None)

    class Meta:
        model = Nouveaute
        fields = ["id", "titre", "texte", "produit", "produit_slug", "image", "publie", "publie_le"]


class NouveautesView(viewsets.ReadOnlyModelViewSet):
    """BF-07 : nouveautés publiées (les plus récentes d'abord)."""

    permission_classes = [AllowAny]
    serializer_class = NouveauteSerializer

    def get_queryset(self):
        return Nouveaute.objects.filter(publie=True, publie_le__lte=timezone.now()).select_related("produit")


class NouveautesAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = NouveauteSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Nouveaute.objects.select_related("produit")
