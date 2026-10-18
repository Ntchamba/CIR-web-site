"""API équipe des commandes (/api/admin/commandes/) : suivi, étapes, négociation, notes internes."""
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .etapes import EQUIPE
from .permissions import EstEquipe
from .serializers import (CommandeDetailEquipeSerializer, CommandeListeEquipeSerializer, CommandeModifEquipeSerializer,
                          EtatEquipeSerializer)
from .views import CommandeBaseViewSet


class CommandeAdminViewSet(mixins.ListModelMixin, CommandeBaseViewSet):
    role = EQUIPE
    permission_classes = [EstEquipe]
    search_fields = ["reference", "client__nom_complet", "client__email", "client__telephone"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return services.commandes_equipe()

    def get_serializer_class(self):
        return CommandeListeEquipeSerializer if self.action == "list" else CommandeDetailEquipeSerializer

    def filter_queryset(self, queryset):
        queryset = services.filtrer_equipe(queryset, self.request.query_params)
        return super().filter_queryset(queryset)

    @action(detail=False, methods=["get"])
    def resume(self, request):
        return Response(services.resume_equipe())

    def partial_update(self, request, pk=None):
        commande = self.get_object()
        donnees = CommandeModifEquipeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.modifier_par_equipe(commande, donnees.validated_data)
        return self.reponse_detail(commande.pk)

    @action(detail=True, methods=["post"])
    def etat(self, request, pk=None):
        commande = self.get_object()
        donnees = EtatEquipeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.changer_etat_equipe(commande, donnees.validated_data["etat"], request.user,
                                     donnees.validated_data["motif"])
        return self.reponse_detail(commande.pk)
