"""API publique du contact (/api/contact/) : envoi par un visiteur ou un client, suivi par le client connecté."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.noyau.authentification import AuthentificationFacultative

from . import anti_robot, services
from .serializers import DemandeEntreeSerializer, DemandeMienneSerializer


class DemandeContactViewSet(viewsets.GenericViewSet):
    """Envoi ouvert à tous (jeton lu s'il est valide, ignoré sinon) ; `miennes/` pour le client connecté."""

    authentication_classes = [AuthentificationFacultative]
    filter_backends = []
    serializer_class = DemandeMienneSerializer

    def get_permissions(self):
        return [IsAuthenticated()] if self.action == "miennes" else [AllowAny()]

    def get_throttles(self):
        return [anti_robot.QuotaContactIP()] if self.action == "create" else []

    def get_queryset(self):
        return services.demandes_de(self.request.user)

    def create(self, request):
        if anti_robot.piege_rempli(request.data):  # robot : faux succès, rien d'enregistré
            return Response(services.faux_succes(), status=status.HTTP_201_CREATED)
        donnees = DemandeEntreeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        valeurs = {c: v for c, v in donnees.validated_data.items() if c != "site_web"}
        demande = services.creer_demande(valeurs, request.user)
        return Response({"id": demande.pk, "reference": demande.reference}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def miennes(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(self.get_serializer(page, many=True).data)
