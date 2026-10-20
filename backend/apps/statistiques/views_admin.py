"""API de l'équipe pour les statistiques (/api/admin/statistiques/)."""
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .permissions import EstEquipe


class ResumeView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.resume(request.user, request.query_params.get("du"), request.query_params.get("au")))


class EvolutionView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.evolution(request.user, request.query_params.get("mois")))
