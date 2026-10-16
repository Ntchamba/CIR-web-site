"""API équipe des comptes (/api/admin/comptes/) : connexion au tableau de bord, équipe, clients."""
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.noyau.permissions import EstEquipe, EstSuperAdmin

from . import services
from .jwt import ConnexionEquipeSerializer
from .models import Utilisateur
from .serializers import ClientDetailSerializer, ClientListeSerializer, MembreEquipeSerializer
from .views import ConnexionView


class ConnexionEquipeView(ConnexionView):
    """Connexion au tableau de bord : refusée aux comptes clients."""

    serializer_class = ConnexionEquipeSerializer


class EquipeViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                    viewsets.GenericViewSet):
    """BF-17 : membres de l'équipe (liste, ajout, désactivation, réactivation). Super-admin seulement."""

    serializer_class = MembreEquipeSerializer
    permission_classes = [EstSuperAdmin]
    search_fields = ["nom_complet", "email", "telephone"]
    ordering_fields = ["nom_complet", "date_inscription"]
    filterset_fields = ["role", "is_active"]

    def get_queryset(self):
        return Utilisateur.objects.equipe().order_by("nom_complet")

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        membre = services.desactiver_membre(request.user, self.get_object())
        return Response(self.get_serializer(membre).data)

    @action(detail=True, methods=["post"])
    def reactiver(self, request, pk=None):
        membre = services.reactiver_membre(request.user, self.get_object())
        return Response(self.get_serializer(membre).data)


class ClientsViewSet(viewsets.ReadOnlyModelViewSet):
    """BF-17 : comptes clients (consultation). Réservé à l'équipe."""

    permission_classes = [EstEquipe]
    search_fields = ["nom_complet", "email", "telephone", "ville", "quartier"]
    ordering_fields = ["date_inscription", "nom_complet"]
    filterset_fields = ["is_active"]

    def get_queryset(self):
        qs = Utilisateur.objects.clients()
        ville = self.request.query_params.get("ville", "").strip()
        if ville:  # saisie libre : « douala » trouve « Douala »
            qs = qs.filter(ville__iexact=ville)
        adresse = self.request.query_params.get("adresse_complete")
        vides = Q(ville="") | Q(quartier="") | Q(rue_ou_repere="")
        if adresse in ("1", "true", "oui"):
            qs = qs.exclude(vides)
        elif adresse in ("0", "false", "non"):
            qs = qs.filter(vides)
        return qs

    def get_serializer_class(self):
        return ClientDetailSerializer if self.action == "retrieve" else ClientListeSerializer
