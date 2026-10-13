from django.db.models import Count, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import EstEquipe

from . import services
from .models import Conversation
from .serializers import ConversationSerializer, MessageSerializer


class _ConversationsBase(viewsets.GenericViewSet):
    serializer_class = ConversationSerializer

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        """GET : historique (100 derniers, ou ?avant=<id> pour remonter). POST : envoyer un message."""
        conversation = self.get_object()
        if request.method == "POST":
            serializer = MessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            message = services.envoyer_message(conversation, request.user, serializer.validated_data["texte"])
            return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
        messages = conversation.messages.select_related("auteur")
        if request.query_params.get("avant"):
            messages = messages.filter(pk__lt=request.query_params["avant"])
        derniers = list(messages.order_by("-cree_le")[:100])[::-1]
        services.marquer_lus(conversation, request.user)
        return Response(MessageSerializer(derniers, many=True).data)

    @action(detail=True, methods=["post"])
    def lu(self, request, pk=None):
        services.marquer_lus(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConversationsView(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                        _ConversationsBase):
    """Messagerie du client : ses conversations (commandes et échanges généraux avec l'équipe)."""

    pagination_class = None

    def get_queryset(self):
        moi = self.request.user
        return (Conversation.objects.filter(client=moi).select_related("commande", "client")
                .annotate(non_lus=Count("messages", filter=Q(messages__lu_par_client=False))))

    def perform_create(self, serializer):
        serializer.save(client=self.request.user, sujet=serializer.validated_data.get("sujet") or "Question à l'équipe")

    @action(detail=False)
    def non_lus(self, request):
        total = sum(c.non_lus for c in self.get_queryset())
        return Response({"non_lus": total})


class ConversationsAdminView(mixins.ListModelMixin, mixins.RetrieveModelMixin, _ConversationsBase):
    """Messagerie de l'équipe : toutes les conversations, les non lues en premier."""

    permission_classes = [EstEquipe]
    search_fields = ["sujet", "client__nom_complet", "commande__numero"]
    filterset_fields = ["client"]

    def get_queryset(self):
        return (Conversation.objects.select_related("commande", "client")
                .annotate(non_lus=Count("messages", filter=Q(messages__lu_par_equipe=False)))
                .order_by("-non_lus", "-modifie_le"))

    @action(detail=False)
    def non_lus(self, request):
        total = sum(c.non_lus for c in self.get_queryset())
        return Response({"non_lus": total})
