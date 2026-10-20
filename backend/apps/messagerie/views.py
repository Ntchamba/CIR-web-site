"""API client de la messagerie (/api/messagerie/) et vues partagées avec l'équipe."""
from django.http import FileResponse
from django.utils.http import content_disposition_header
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from . import pieces_jointes, services
from .permissions import EstClient, EstConnecte
from .serializers import (EnvoiMessageSerializer, LuSerializer, MessageSerializer, PieceJointeSerializer,
                          base_url_de)


def reponse_messages(request, conversation):
    """GET messages : `{results, a_plus}`."""
    messages, a_plus = services.page_messages(conversation, request.query_params)
    donnees = MessageSerializer(messages, many=True, context={"request": request}).data
    return Response({"results": donnees, "a_plus": a_plus})


def reponse_envoi(request, conversation):
    """POST messages : JSON ou multipart ; 201 avec le <Message> (200 si l'envoi rejoué existait déjà)."""
    serializer = EnvoiMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    donnees = serializer.validated_data
    message, cree = services.envoyer_message(
        conversation, request.user, texte=donnees["texte"], commande=donnees["commande"],
        cle_client=donnees["cle_client"], pieces_ids=donnees["pieces_jointes"],
        fichiers=request.FILES.getlist("fichiers"), base_url=base_url_de(request))
    return Response(MessageSerializer(message, context={"request": request}).data,
                    status=status.HTTP_201_CREATED if cree else status.HTTP_200_OK)


def reponse_lu(request, conversation):
    serializer = LuSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response({"non_lus": services.marquer_lu(conversation, request.user, serializer.validated_data["jusqu_a"])})


def reponse_piece_envoyee(request):
    fichier = request.FILES.get("fichier")
    if fichier is None:
        raise ValidationError({"fichier": [_("Joignez un fichier.")]})
    piece = services.envoyer_piece(request.user, fichier)
    return Response(PieceJointeSerializer(piece, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ConversationView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        conversation = services.conversation_du_client(request.user)
        dernier = services.messages_de(conversation).order_by("-id").first()
        return Response({
            "id": conversation.pk,
            "non_lus": services.non_lus_client(request.user),
            "dernier_message": MessageSerializer(dernier, context={"request": request}).data if dernier else None,
        })


class MessagesView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        return reponse_messages(request, services.conversation_du_client(request.user))

    def post(self, request):
        return reponse_envoi(request, services.conversation_du_client(request.user))


class PiecesJointesView(APIView):
    permission_classes = [EstClient]

    def post(self, request):
        return reponse_piece_envoyee(request)


class PieceJointeView(APIView):
    """Téléchargement d'une pièce jointe : client de la conversation ou équipe (404 pour tout autre)."""

    permission_classes = [EstConnecte]

    def get(self, request, pk):
        piece = services.telecharger_piece(request.user, pk)
        try:
            fichier = piece.fichier.open("rb")
        except FileNotFoundError:
            raise NotFound(_("Fichier introuvable.")) from None
        en_piece = piece.type == "document"
        reponse = FileResponse(fichier, content_type="application/pdf" if en_piece else "image/webp")
        reponse["Content-Disposition"] = content_disposition_header(en_piece, pieces_jointes.nom_de_telechargement(piece))
        reponse["X-Content-Type-Options"] = "nosniff"
        reponse["Cache-Control"] = "private, no-store"
        reponse["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return reponse


class LuView(APIView):
    permission_classes = [EstClient]

    def post(self, request):
        return reponse_lu(request, services.conversation_du_client(request.user))


class NonLusView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        return Response({"non_lus": services.non_lus_client(request.user)})
