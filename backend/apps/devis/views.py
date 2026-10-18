"""API client des devis (/api/devis/) : demandes de rendu et devis reçus (lecture seule)."""
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from . import services
from .permissions import EstClient
from .serializers import (DemandeRenduEntreeSerializer, DemandeRenduSerializer, DevisDetailSerializer,
                          DevisResumeSerializer)


class DemandeRenduViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Demandes de rendu du client : dépôt (multipart, images WebP), liste, détail avec devis envoyés."""

    permission_classes = [EstClient]
    serializer_class = DemandeRenduSerializer
    filter_backends = []
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        return services.demandes_du_client(self.request.user)

    def create(self, request):
        donnees = DemandeRenduEntreeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        valeurs = dict(donnees.validated_data)
        fichiers = valeurs.pop("images", [])
        demande = services.deposer_demande(request.user, valeurs, fichiers)
        demande = self.get_queryset().get(pk=demande.pk)
        return Response(self.get_serializer(demande).data, status=status.HTTP_201_CREATED)


class DevisViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Devis reçus par le client : jamais les brouillons ; lecture seule (il répond par la négociation)."""

    permission_classes = [EstClient]
    filter_backends = []
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        return services.devis_du_client(self.request.user)

    def get_serializer_class(self):
        return DevisResumeSerializer if self.action == "list" else DevisDetailSerializer
