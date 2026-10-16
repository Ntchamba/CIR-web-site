"""API publique des actualités (/api/actualites/) : publiées et dont la date est passée (`?taille=3` : accueil)."""
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from . import services
from .serializers import ActualitePublicSerializer


class ActualiteViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActualitePublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # lecture publique : un jeton périmé ne doit pas bloquer (401)
    filter_backends = []
    lookup_field = "slug"

    def get_queryset(self):
        return services.actualites_publiques()
