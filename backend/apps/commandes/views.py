"""API client des commandes (/api/commandes/). Les règles métier sont dans services.py, jamais ici.

`CommandeBaseViewSet` porte les routes communes au client et à l'équipe (détail, propositions, réponses) ;
`views_admin.py` en dérive l'API de l'équipe avec `role = "equipe"`.
"""
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .etapes import CLIENT
from .models import Proposition
from .permissions import EstClient
from .serializers import (CommandeCreationSerializer, CommandeDetailSerializer, CommandeListeSerializer,
                          CommandeModifClientSerializer, MotifSerializer, PropositionEntreeSerializer,
                          PropositionSerializer, ReponseSerializer)


class CommandeBaseViewSet(viewsets.GenericViewSet):
    """Routes communes : le rôle (`client` ou `equipe`) fixe ce que chaque partie voit et peut faire."""

    role = CLIENT
    serializer_class = CommandeDetailSerializer
    ordering_fields = ["cree_le", "modifie_le"]
    search_fields = []

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "role": self.role}

    def reponse_detail(self, commande_id):
        """Détail à jour d'une commande (relue avec ses préchargements)."""
        commande = get_object_or_404(services.avec_detail(self.get_queryset()), pk=commande_id)
        return Response(self.get_serializer(commande).data)

    def retrieve(self, request, pk=None):
        return self.reponse_detail(pk)

    @action(detail=True, methods=["post"], url_path="propositions")
    def propositions(self, request, pk=None):
        commande = self.get_object()
        donnees = PropositionEntreeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        valeurs = {c: donnees.validated_data.get(c) for c in ("prix_m2", "total", "delai_jours")}
        valeurs["message"] = donnees.validated_data.get("message", "")
        proposition = services.proposer(commande, request.user, self.role, valeurs)
        reponse = PropositionSerializer(proposition, context=self.get_serializer_context())
        return Response(reponse.data, status=status.HTTP_201_CREATED)

    def _repondre(self, request, pk, pid, accepter):
        commande = self.get_object()
        proposition = get_object_or_404(Proposition, pk=pid, commande=commande)
        donnees = ReponseSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.repondre(proposition, request.user, self.role, accepter, donnees.validated_data["message"])
        return self.reponse_detail(commande.pk)

    @action(detail=True, methods=["post"], url_path=r"propositions/(?P<pid>\d+)/accepter")
    def accepter(self, request, pk=None, pid=None):
        return self._repondre(request, pk, pid, True)

    @action(detail=True, methods=["post"], url_path=r"propositions/(?P<pid>\d+)/refuser")
    def refuser(self, request, pk=None, pid=None):
        return self._repondre(request, pk, pid, False)


class CommandeViewSet(mixins.ListModelMixin, CommandeBaseViewSet):
    """Commandes du client connecté : liste, création, détail, correction, annulation, négociation."""

    permission_classes = [EstClient]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return services.commandes_du_client(self.request.user)

    def get_serializer_class(self):
        return CommandeListeSerializer if self.action == "list" else CommandeDetailSerializer

    def filter_queryset(self, queryset):
        queryset = services.filtrer_client(queryset, self.request.query_params)
        return super().filter_queryset(queryset)

    def create(self, request):
        donnees = CommandeCreationSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        commande = services.creer_commande(request.user, donnees.validated_data)
        reponse = self.reponse_detail(commande.pk)
        reponse.status_code = status.HTTP_201_CREATED
        return reponse

    def partial_update(self, request, pk=None):
        commande = self.get_object()
        donnees = CommandeModifClientSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.modifier_par_client(commande, donnees.validated_data)
        return self.reponse_detail(commande.pk)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        commande = self.get_object()
        donnees = MotifSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        services.annuler(commande, request.user, self.role, donnees.validated_data["motif"])
        return self.reponse_detail(commande.pk)
