"""API de l'équipe pour les appels (/api/admin/appels/)."""
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.noyau.pagination import PaginationStandard

from . import services
from .permissions import EstEquipe
from .serializers import AppelEquipeSerializer, AppelSerializer


class HistoriqueView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        paginateur = PaginationStandard()
        page = paginateur.paginate_queryset(services.historique(request.query_params), request, view=self)
        reponse = paginateur.get_paginated_response(AppelEquipeSerializer(page, many=True).data)
        services.marquer_manques_vus()  # l'équipe a ouvert la liste
        return reponse


class EnAttenteView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(AppelSerializer(services.en_attente(), many=True).data)


class RepondreView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request, pk):
        appel, jitsi = services.repondre(request.user, pk)
        return Response({"appel": AppelSerializer(appel).data, "jitsi": jitsi})


class RefuserView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request, pk):
        return Response({"appel": AppelSerializer(services.refuser(request.user, pk)).data})


class TerminerEquipeView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request, pk):
        return Response({"appel": AppelSerializer(services.terminer(request.user, pk)).data})


class UsageView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.usage())


class ResumeView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.resume())
