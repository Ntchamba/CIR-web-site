"""WebSocket de la messagerie instantanée.

ws/messagerie/<id>/      une conversation ouverte : messages reçus et envoyés en direct
ws/notifications/        badges « non lus » (toutes les conversations de l'utilisateur)
"""
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from . import services
from .models import Conversation


class ConversationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.utilisateur = self.scope.get("user")
        self.conversation_id = int(self.scope["url_route"]["kwargs"]["conversation_id"])
        self.conversation = await self._conversation()
        if self.conversation is None:
            await self.close(code=4403)
            return
        self.groupe = services.groupe_conversation(self.conversation_id)
        await self.channel_layer.group_add(self.groupe, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if getattr(self, "groupe", None):
            await self.channel_layer.group_discard(self.groupe, self.channel_name)

    async def receive_json(self, contenu, **kwargs):
        genre = contenu.get("type")
        if genre == "message":
            texte = str(contenu.get("texte", "")).strip()[:4000]
            if texte:
                await database_sync_to_async(services.envoyer_message)(self.conversation, self.utilisateur, texte)
        elif genre == "lu":
            await database_sync_to_async(services.marquer_lus)(self.conversation, self.utilisateur)
        elif genre == "saisie":  # « l'équipe écrit… »
            await self.channel_layer.group_send(self.groupe, {
                "type": "saisie.en_cours", "de_l_equipe": self.utilisateur.is_staff,
                "expediteur": self.channel_name})

    async def message_nouveau(self, evenement):
        await self.send_json({"type": "message", "message": evenement["message"]})

    async def saisie_en_cours(self, evenement):
        if evenement["expediteur"] != self.channel_name:
            await self.send_json({"type": "saisie", "de_l_equipe": evenement["de_l_equipe"]})

    @database_sync_to_async
    def _conversation(self):
        conversation = Conversation.objects.filter(pk=self.conversation_id).first()
        return conversation if conversation and conversation.accessible_par(self.utilisateur) else None


class NotificationsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        utilisateur = self.scope.get("user")
        if not utilisateur or not utilisateur.is_authenticated:
            await self.close(code=4401)
            return
        self.groupe = services.groupe_utilisateur(utilisateur)
        await self.channel_layer.group_add(self.groupe, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if getattr(self, "groupe", None):
            await self.channel_layer.group_discard(self.groupe, self.channel_name)

    async def conversation_maj(self, evenement):
        await self.send_json({"type": "conversation", "conversation": evenement["conversation"],
                              "message": evenement["message"]})
