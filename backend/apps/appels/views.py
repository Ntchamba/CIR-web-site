"""API client des appels (/api/appels/) et webhook JaaS."""
import os

from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import salles, services
from .permissions import EstClient
from .serializers import AppelSerializer, LancerAppelSerializer


class DisponibiliteView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        return Response(services.disponibilite())


class AppelsView(APIView):
    permission_classes = [EstClient]

    def post(self, request):
        serializer = LancerAppelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appel, jitsi = services.lancer(request.user, serializer.validated_data["type"],
                                       serializer.validated_data["commande"])
        return Response({"appel": AppelSerializer(appel).data, "jitsi": jitsi}, status=status.HTTP_201_CREATED)


class AppelView(APIView):
    permission_classes = [EstClient]

    def get(self, request, pk):
        return Response({"appel": AppelSerializer(services.appel_du_client(request.user, pk)).data})


class AnnulerView(APIView):
    permission_classes = [EstClient]

    def post(self, request, pk):
        return Response({"appel": AppelSerializer(services.annuler(request.user, pk)).data})


class TerminerView(APIView):
    permission_classes = [EstClient]

    def post(self, request, pk):
        return Response({"appel": AppelSerializer(services.terminer(request.user, pk)).data})


class WebhookJaasView(APIView):
    """Événements JaaS : sans jeton JWT, protégés par un secret partagé comparé en temps constant.

    503 si le secret n'est pas configuré, 403 s'il est faux, 204 sinon. Les événements inconnus sont ignorés.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not os.environ.get("JAAS_WEBHOOK_SECRET"):
            return Response({"detail": _("Webhook non configuré."), "code": "webhook_non_configure"},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not salles.webhooks.verifier(request.headers, request.body):
            return Response({"detail": _("Secret du webhook invalide.")}, status=status.HTTP_403_FORBIDDEN)
        services.traiter_evenements(salles.webhooks.analyser(request.body))
        return Response(status=status.HTTP_204_NO_CONTENT)
