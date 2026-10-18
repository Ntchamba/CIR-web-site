"""API équipe des devis (/api/admin/devis/) : devis, aperçu du calcul, envoi, demandes de rendu."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .models import Devis
from .permissions import EstEquipe
from .serializers import (ApercuSerializer, DemandeRenduAdminSerializer, DemandeRenduMajSerializer,
                          DevisAdminListeSerializer, DevisAdminSerializer, DevisEcritureSerializer,
                          apercu_representation)


class DevisAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin,
                        viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_regex = "[0-9]+"
    filterset_fields = ["commande", "etat"]
    search_fields = ["reference", "commande__reference", "commande__client__nom_complet",
                     "commande__client__email"]
    ordering_fields = ["cree_le", "envoye_le"]

    def get_queryset(self):
        return services.devis_equipe()

    def get_serializer_class(self):
        return DevisAdminListeSerializer if self.action == "list" else DevisAdminSerializer

    def relire(self, devis):
        return DevisAdminSerializer(self.get_queryset().get(pk=devis.pk), context=self.get_serializer_context()).data

    def create(self, request):
        donnees = DevisEcritureSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        devis = services.enregistrer_devis(None, donnees.validated_data, request.user)
        return Response(self.relire(devis), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        devis = self.get_object()
        donnees = DevisEcritureSerializer(data=request.data, partial=True)
        donnees.is_valid(raise_exception=True)
        services.enregistrer_devis(devis, donnees.validated_data, request.user)
        return Response(self.relire(devis))

    def perform_destroy(self, instance):
        services.supprimer_devis(instance)

    @action(detail=False, methods=["post"])
    def calculer(self, request):
        donnees = ApercuSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        return Response(apercu_representation(donnees.validated_data["lignes"]))

    @action(detail=True, methods=["post"])
    def envoyer(self, request, pk=None):
        devis = services.envoyer(self.get_object(), request.user)
        return Response(self.relire(devis))


class DemandeRenduAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    serializer_class = DemandeRenduAdminSerializer
    http_method_names = ["get", "patch", "head", "options"]
    lookup_value_regex = "[0-9]+"
    filterset_fields = ["etat"]
    search_fields = ["reference", "description", "client__nom_complet", "client__email", "client__telephone"]
    ordering_fields = ["cree_le"]

    def get_queryset(self):
        return services.demandes_equipe()

    @action(detail=False, methods=["get"])
    def resume(self, request):
        return Response(services.resume_demandes())

    def partial_update(self, request, pk=None):
        demande = self.get_object()
        donnees = DemandeRenduMajSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.mettre_a_jour_demande(demande, donnees.validated_data)
        demande = self.get_queryset().get(pk=demande.pk)
        return Response(self.get_serializer(demande).data)
