from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User

from .auth import JWTAuthMiddleware
from .models import Conversation
from .routing import websocket_urlpatterns


class MessagerieAPITests(APITestCase):
    def setUp(self):
        self.client_cir = User.objects.create_user("c@test.cm", "Mot-de-passe-1", nom_complet="Client")
        self.equipe = User.objects.create_user("e@test.cm", "Mot-de-passe-1", nom_complet="Équipe", is_staff=True)

    def test_echange_et_non_lus(self):
        self.client.force_authenticate(self.client_cir)
        conv = self.client.post("/api/messagerie/conversations/", {"sujet": "Question"}, format="json").data
        self.client.post(f"/api/messagerie/conversations/{conv['id']}/messages/", {"texte": "Bonjour"})

        self.client.force_authenticate(self.equipe)
        liste = self.client.get("/api/admin/messagerie/conversations/").data["results"]
        self.assertEqual(liste[0]["non_lus"], 1)
        self.client.get(f"/api/admin/messagerie/conversations/{conv['id']}/messages/")  # lecture
        self.assertEqual(self.client.get("/api/admin/messagerie/conversations/non_lus/").data["non_lus"], 0)

    def test_conversation_privee(self):
        conv = Conversation.objects.create(client=self.client_cir)
        intrus = User.objects.create_user("x@test.cm", "Mot-de-passe-1", nom_complet="X")
        self.client.force_authenticate(intrus)
        self.assertEqual(self.client.get(f"/api/messagerie/conversations/{conv.pk}/messages/").status_code, 404)


class MessagerieTempsReelTests(TransactionTestCase):
    async def test_message_recu_en_direct(self):
        from asgiref.sync import sync_to_async

        client = await sync_to_async(User.objects.create_user)("c2@test.cm", "Mot-de-passe-1", nom_complet="C")
        equipe = await sync_to_async(User.objects.create_user)("e2@test.cm", "Mot-de-passe-1", nom_complet="E",
                                                              is_staff=True)
        conv = await sync_to_async(Conversation.objects.create)(client=client)
        app = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))

        cote_client = WebsocketCommunicator(app, f"/ws/messagerie/{conv.pk}/?jeton={AccessToken.for_user(client)}")
        cote_equipe = WebsocketCommunicator(app, f"/ws/messagerie/{conv.pk}/?jeton={AccessToken.for_user(equipe)}")
        self.assertTrue((await cote_client.connect())[0])
        self.assertTrue((await cote_equipe.connect())[0])

        await cote_client.send_json_to({"type": "message", "texte": "Bonjour l'équipe"})
        recu = await cote_equipe.receive_json_from(timeout=3)
        self.assertEqual(recu["message"]["texte"], "Bonjour l'équipe")

        intrus = WebsocketCommunicator(app, f"/ws/messagerie/{conv.pk}/")
        connecte, _ = await intrus.connect()
        self.assertFalse(connecte)
        await cote_client.disconnect()
        await cote_equipe.disconnect()
