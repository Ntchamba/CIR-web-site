"""API équipe du contact (/api/admin/contact/) : boîte de réception des demandes."""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .permissions import EstEquipe
from .serializers import DemandeAdminSerializer, DemandeMajSerializer


class DemandeContactAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    serializer_class = DemandeAdminSerializer
    http_method_names = ["get", "patch", "head", "options"]
    lookup_value_regex = "[0-9]+"
    filterset_fields = ["etat", "type"]
    search_fields = ["reference", "nom", "email", "telephone", "message"]
    ordering_fields = ["cree_le", "traitee_le"]

    def get_queryset(self):
        return services.demandes_equipe()

    @action(detail=False, methods=["get"])
    def resume(self, request):
        return Response(services.resume_equipe())

    def partial_update(self, request, pk=None):
        demande = self.get_object()
        donnees = DemandeMajSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.mettre_a_jour(demande, donnees.validated_data)
        return Response(self.get_serializer(demande).data)
