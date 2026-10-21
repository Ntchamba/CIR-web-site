"""API publique de l'assistant (/api/assistant/) : accès libre et limité, JWT facultatif (un client connecté est reconnu)."""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle
from rest_framework.views import APIView

from apps.noyau.authentification import AuthentificationFacultative

from . import services
from .serializers import AvisSerializer, MessageEntreeSerializer, MessagePublicSerializer


class VueAssistant(APIView):
    authentication_classes = [AuthentificationFacultative]
    permission_classes = [AllowAny]


class DisponibiliteView(VueAssistant):
    def get(self, request):
        return Response(services.disponibilite())


class MessagesView(VueAssistant):
    def post(self, request):
        donnees = MessageEntreeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        ip = BaseThrottle().get_ident(request)
        resultat = services.envoyer_message(request.user, ip, donnees.validated_data)
        return Response({"cle": resultat["cle"], "message": MessagePublicSerializer(resultat["message"]).data,
                         "proposer_contact": resultat["proposer_contact"], "restant": resultat["restant"]})


class ConversationView(VueAssistant):
    def get(self, request, cle):
        conversation = services.conversation_de(cle, request.user)
        return Response({"cle": str(conversation.cle),
                         "messages": MessagePublicSerializer(services.messages_de(conversation), many=True).data})

    def delete(self, request, cle):
        services.supprimer_conversation(services.conversation_de(cle, request.user))
        return Response(status=status.HTTP_204_NO_CONTENT)


class AvisView(VueAssistant):
    def post(self, request, pk):
        donnees = AvisSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        cle = donnees.validated_data["cle"] or request.headers.get("X-Assistant-Cle")
        services.donner_avis(pk, request.user, cle, donnees.validated_data["utile"])
        return Response(status=status.HTTP_204_NO_CONTENT)
