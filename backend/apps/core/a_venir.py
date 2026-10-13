"""Réponse commune des modules prévus mais pas encore développés (paiement, appels)."""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class ModuleAVenir(APIView):
    """Répond 501 avec une explication : le front-end affiche « Bientôt disponible »."""

    permission_classes = [AllowAny]
    module = ""
    description = ""

    def get(self, request, *args, **kwargs):
        return Response({"module": self.module, "disponible": False, "description": self.description},
                        status=status.HTTP_501_NOT_IMPLEMENTED)

    post = get
