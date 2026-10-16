"""API publique des contenus (/api/contenus/) : l'accueil en une seule requête."""
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import services
from .serializers import AccueilPublicSerializer


class AccueilView(generics.GenericAPIView):
    """Titre, accroche, vidéo de fond, coordonnées, bandeaux actifs et sphère de photos."""

    serializer_class = AccueilPublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # lecture publique : un jeton périmé ne doit pas bloquer (401)

    def get(self, request, *args, **kwargs):
        donnees = services.donnees_accueil()
        contexte = {**self.get_serializer_context(), "bandeaux": donnees["bandeaux"], "sphere": donnees["sphere"]}
        return Response(AccueilPublicSerializer(donnees["contenu"], context=contexte).data)
