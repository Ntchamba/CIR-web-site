"""API équipe des actualités (/api/admin/actualites/) : création, modification, programmation."""
from rest_framework import viewsets

from apps.noyau.permissions import EstEquipe

from . import services
from .serializers import ActualiteAdminSerializer


class ActualiteAdminViewSet(viewsets.ModelViewSet):
    serializer_class = ActualiteAdminSerializer
    permission_classes = [EstEquipe]
    search_fields = ["titre", "resume"]
    filterset_fields = ["publie", "produit"]
    ordering_fields = ["publie_le", "cree_le"]

    def get_queryset(self):
        return services.actualites_equipe()

    def perform_destroy(self, instance):
        services.supprimer_actualite(instance)
