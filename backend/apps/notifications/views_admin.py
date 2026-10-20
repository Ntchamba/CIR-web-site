"""API de l'équipe pour les notifications (/api/admin/notifications/)."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.noyau.pagination import PaginationStandard

from . import services
from .permissions import EstEquipe, EstSuperAdmin
from .serializers import (ApercuSerializer, EnvoiSerializer, ModeleSerializer, NotificationSerializer,
                          PreferencesEquipeSerializer)
from . import views as v


class ListeEquipeView(v.ListeNotificationsView):
    permission_classes = [EstEquipe]
    equipe = True


class NonLuesEquipeView(v.NonLuesView):
    permission_classes = [EstEquipe]


class MarquerLueEquipeView(v.MarquerLueView):
    permission_classes = [EstEquipe]
    equipe = True


class MarquerToutesLuesEquipeView(v.MarquerToutesLuesView):
    permission_classes = [EstEquipe]


class PreferencesEquipeView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.preferences_equipe(request.user))

    def patch(self, request):
        serializer = PreferencesEquipeSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for champ, valeur in serializer.validated_data.items():
            services.modifier_preference(request.user, champ, valeur)
        return Response(services.preferences_equipe(request.user))


# --- Super-administrateur ---

class ModelesView(APIView):
    permission_classes = [EstSuperAdmin]

    def get(self, request):
        return Response(services.liste_modeles())


class ModeleView(APIView):
    permission_classes = [EstSuperAdmin]

    def put(self, request, evenement, langue):
        serializer = ModeleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        modele = services.enregistrer_modele(evenement, langue, serializer.validated_data)
        return Response({"evenement": modele.evenement, "langue": modele.langue, "sujet": modele.sujet,
                         "introduction": modele.introduction})

    def delete(self, request, evenement, langue):
        services.supprimer_modele(evenement, langue)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApercuView(APIView):
    permission_classes = [EstSuperAdmin]

    def post(self, request):
        serializer = ApercuSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donnees = serializer.validated_data
        return Response(services.apercu(donnees["evenement"], donnees["langue"], donnees))


class EnvoisView(APIView):
    permission_classes = [EstSuperAdmin]

    def get(self, request):
        paginateur = PaginationStandard()
        page = paginateur.paginate_queryset(services.envois(request.query_params), request, view=self)
        return paginateur.get_paginated_response(EnvoiSerializer(page, many=True).data)


class ResumeEnvoisView(APIView):
    permission_classes = [EstSuperAdmin]

    def get(self, request):
        return Response(services.resume_envois())


class ReessayerView(APIView):
    permission_classes = [EstSuperAdmin]

    def post(self, request, pk):
        return Response(EnvoiSerializer(services.reessayer(pk)).data)
