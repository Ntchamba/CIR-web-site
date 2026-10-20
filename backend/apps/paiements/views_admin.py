"""API de l'équipe pour les paiements (/api/admin/paiements/)."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.noyau.pagination import PaginationStandard

from . import services
from .permissions import EstEquipe
from .serializers import PaiementEquipeSerializer, ReglementSerializer


class PaiementsView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        paginateur = PaginationStandard()
        page = paginateur.paginate_queryset(services.paiements_equipe(request.query_params), request, view=self)
        return paginateur.get_paginated_response(PaiementEquipeSerializer(page, many=True).data)


class PaiementView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request, pk):
        return Response(PaiementEquipeSerializer(services.paiement_pour_equipe(pk)).data)


class ReverifierView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request, pk):
        return Response(PaiementEquipeSerializer(services.reverifier(pk)).data)


class ReglementView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request, commande_id):
        donnees = ReglementSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        paiement = services.enregistrer_reglement(commande_id, request.user, **donnees.validated_data)
        return Response(PaiementEquipeSerializer(paiement).data, status=status.HTTP_201_CREATED)


class ResumeView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.resume_equipe(request.user))
