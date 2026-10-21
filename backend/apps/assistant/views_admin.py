"""API équipe de l'assistant (/api/admin/assistant/) : statut, brouillons, journal, conversations (super-admin)."""
from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Brouillon, ConversationAssistant, JournalAssistant
from .permissions import EstEquipe, EstSuperAdmin
from .serializers import (BrouillonSerializer, ConversationAdminSerializer, ConversationDetailAdminSerializer,
                          JournalSerializer)


class StatutView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.statut())


class BrouillonViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    serializer_class = BrouillonSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    lookup_value_regex = "[0-9]+"
    filterset_fields = ["type", "etat", "cible_type", "cible_id"]
    ordering_fields = ["cree_le", "traite_le"]
    search_fields = []

    def get_queryset(self):
        return Brouillon.objects.select_related("cree_par", "traite_par")

    def create(self, request):
        brouillon = services.creer_brouillon(request.user, request.data if hasattr(request.data, "get") else {})
        return Response(self.get_serializer(brouillon).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        donnees = request.data if hasattr(request.data, "get") else {}
        brouillon = services.traiter_brouillon(pk, request.user, donnees)
        return Response(self.get_serializer(brouillon).data)


class JournalViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    serializer_class = JournalSerializer
    filterset_fields = ["agent", "resultat"]
    ordering_fields = ["cree_le"]
    search_fields = []

    def get_queryset(self):
        return JournalAssistant.objects.all()

    @action(detail=False, methods=["get"])
    def resume(self, request):
        return Response(services.resume_journal())


class ConversationAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Lecture des échanges pour améliorer l'assistant : super-administrateur seulement, et journalisée."""

    permission_classes = [EstSuperAdmin]
    lookup_field = "cle"
    lookup_value_regex = "[0-9a-fA-F-]{32,36}"
    filterset_fields = ["langue"]
    ordering_fields = ["derniere_activite_le", "cree_le"]
    search_fields = []

    def get_queryset(self):
        return (ConversationAssistant.objects.annotate(nombre_messages=Count("messages"))
                .order_by("-derniere_activite_le", "-id"))

    def get_serializer_class(self):
        return ConversationDetailAdminSerializer if self.action == "retrieve" else ConversationAdminSerializer

    def list(self, request, *args, **kwargs):
        services.consulter_conversations(request.user, "liste")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        services.consulter_conversations(request.user, "detail")
        return super().retrieve(request, *args, **kwargs)
