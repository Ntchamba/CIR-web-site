"""API de l'équipe pour la messagerie (/api/admin/messagerie/)."""
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.noyau.pagination import PaginationStandard

from . import services
from .permissions import EstEquipe
from .serializers import ConversationEquipeSerializer
from .views import PieceJointeView, reponse_envoi, reponse_lu, reponse_messages, reponse_piece_envoyee


class ConversationsView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        paginateur = PaginationStandard()
        page = paginateur.paginate_queryset(services.conversations_equipe(request.query_params), request, view=self)
        return paginateur.get_paginated_response(ConversationEquipeSerializer(page, many=True).data)

    def post(self, request):
        """Ouvre (ou retrouve) la conversation d'un client : 201 si créée, 200 sinon."""
        client_id = request.data.get("client")
        if not str(client_id or "").isdigit():
            raise ValidationError({"client": [_("Indiquez le client.")]})
        conversation, cree = services.ouvrir_conversation(int(client_id))
        ligne = services.conversations_equipe({}).get(pk=conversation.pk)
        return Response(ConversationEquipeSerializer(ligne).data,
                        status=status.HTTP_201_CREATED if cree else status.HTTP_200_OK)


class MessagesEquipeView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request, pk):
        return reponse_messages(request, services.conversation_pour(request.user, pk))

    def post(self, request, pk):
        return reponse_envoi(request, services.conversation_pour(request.user, pk))


class LuEquipeView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request, pk):
        return reponse_lu(request, services.conversation_pour(request.user, pk))


class ResumeView(APIView):
    permission_classes = [EstEquipe]

    def get(self, request):
        return Response(services.resume_equipe())


class PiecesJointesEquipeView(APIView):
    permission_classes = [EstEquipe]

    def post(self, request):
        return reponse_piece_envoyee(request)


class PieceJointeEquipeView(PieceJointeView):
    """Même vue de téléchargement que côté client (adresse `/api/admin/…`)."""
