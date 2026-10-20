"""Sécurité du WebSocket /ws/ (compléments du testeur) : jeton, taille des trames, isolation, origine."""
import json
from datetime import timedelta
from unittest import mock

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.catalogue.tests.outils import creer_client, creer_membre
from apps.messagerie import services
from apps.messagerie.consumers import ConsommateurDirect
from apps.messagerie.models import Message
from apps.notifications import services as notifications
from config.origine import valider_origine


def jeton(utilisateur):
    return str(AccessToken.for_user(utilisateur))


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
                   CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class SecuriteDirectTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.client_a = creer_client("a@exemple.cm", "Alice Client")
        self.client_b = creer_client("b@exemple.cm", "Bruno Client")
        self.membre = creer_membre()
        self.ouverts = []

    async def connecter(self, utilisateur=None):
        com = WebsocketCommunicator(ConsommateurDirect.as_asgi(), "/ws/")
        self.ouverts.append(com)
        ok, _ = await com.connect()
        self.assertTrue(ok)
        if utilisateur is not None:
            await com.send_json_to({"type": "authentifier", "jeton": await database_sync_to_async(jeton)(utilisateur)})
            self.assertEqual((await com.receive_json_from())["type"], "pret")
        return com

    async def fermer_tout(self):
        for com in self.ouverts:
            try:
                await com.disconnect()
            except Exception:  # noqa: BLE001
                pass

    async def silence(self, com, delai=0.3):
        self.assertTrue(await com.receive_nothing(timeout=delai))

    async def test_le_delai_est_annule_apres_une_authentification_reussie(self):
        with mock.patch.object(ConsommateurDirect, "DELAI_AUTHENTIFICATION", 0.2):
            com = await self.connecter(self.client_a)
            await self.silence(com, 0.6)  # le délai est passé : aucune fermeture, aucune erreur
            await com.send_json_to({"type": "ping"})
            self.assertEqual((await com.receive_json_from())["type"], "pong")
        await self.fermer_tout()

    async def test_jeton_de_rafraichissement_refuse(self):
        refresh = await database_sync_to_async(lambda: str(RefreshToken.for_user(self.client_a)))()
        com = await self.connecter()
        await com.send_json_to({"type": "authentifier", "jeton": refresh})
        self.assertEqual((await com.receive_json_from())["code"], "non_authentifie")
        self.assertEqual((await com.receive_output())["code"], 4401)

    async def test_jeton_signe_avec_une_autre_cle_refuse(self):
        falsifie = jeton(self.client_a)
        falsifie = falsifie[:-4] + ("AAAA" if not falsifie.endswith("AAAA") else "BBBB")
        com = await self.connecter()
        await com.send_json_to({"type": "authentifier", "jeton": falsifie})
        self.assertEqual((await com.receive_json_from())["code"], "non_authentifie")
        self.assertEqual((await com.receive_output())["code"], 4401)

    async def test_jeton_d_un_compte_supprime_refuse(self):
        fantome = await database_sync_to_async(creer_client)("fantome@exemple.cm", "Fantôme")
        valeur = await database_sync_to_async(jeton)(fantome)
        await database_sync_to_async(fantome.delete)()
        com = await self.connecter()
        await com.send_json_to({"type": "authentifier", "jeton": valeur})
        self.assertEqual((await com.receive_json_from())["code"], "non_authentifie")
        self.assertEqual((await com.receive_output())["code"], 4401)

    async def test_pas_de_seconde_authentification(self):
        com = await self.connecter(self.client_a)
        await com.send_json_to({"type": "authentifier", "jeton": await database_sync_to_async(jeton)(self.membre)})
        self.assertEqual((await com.receive_json_from())["code"], "format_invalide")
        await com.send_json_to({"type": "ping"})
        self.assertEqual((await com.receive_json_from())["type"], "pong")
        # la connexion reste celle du client : pas de bascule vers le compte de l'équipe
        await com.send_json_to({"type": "envoyer", "texte": "x", "conversation": 999999})
        self.assertEqual((await com.receive_json_from())["code"], "interdit")  # un membre aurait reçu « inconnue »
        await self.fermer_tout()

    async def test_taille_mesuree_en_octets_pas_en_caracteres(self):
        com = await self.connecter(self.client_a)
        # 9000 caractères « é » = 18 000 octets en UTF-8 : plus de 16 Ko
        await com.send_to(text_data=json.dumps({"type": "envoyer", "texte": "é" * 9000}, ensure_ascii=False))
        self.assertEqual((await com.receive_output())["code"], 4413)

    async def test_trame_binaire_trop_grosse_ferme_en_4413(self):
        com = await self.connecter()  # même avant l'authentification
        await com.send_to(bytes_data=b"x" * (16 * 1024 + 1))
        self.assertEqual((await com.receive_output())["code"], 4413)

    async def test_trame_de_16_ko_exactement_acceptee(self):
        com = await self.connecter(self.client_a)
        base = json.dumps({"type": "ping"})
        await com.send_to(text_data=base + " " * (16 * 1024 - len(base)))
        self.assertEqual((await com.receive_json_from())["type"], "pong")
        await self.fermer_tout()

    async def test_trame_binaire_valide_refusee_proprement(self):
        com = await self.connecter(self.client_a)
        await com.send_to(bytes_data=b'{"type": "ping"}')
        self.assertEqual((await com.receive_json_from())["code"], "format_invalide")
        await self.fermer_tout()

    async def test_aucun_message_ni_notification_d_un_autre_client(self):
        conversation = await database_sync_to_async(services.conversation_du_client)(self.client_a)
        ws_a, ws_b, equipe = await self.connecter(self.client_a), await self.connecter(self.client_b), \
            await self.connecter(self.membre)
        await database_sync_to_async(services.envoyer_message)(conversation, self.client_a, texte="Privé A")
        await database_sync_to_async(services.envoyer_message)(conversation, self.membre, texte="Réponse à A")
        await database_sync_to_async(notifications.notifier)(self.client_a, "commande_creee",
                                                             {"commande": 1, "reference": "CIR-1", "nom": "A"})
        # B n'a reçu aucune trame (ni message, ni compteur, ni notification)
        await self.silence(ws_b)
        # A a bien reçu les siennes
        vues = set()
        while not await ws_a.receive_nothing(timeout=0.3):
            vues.add((await ws_a.receive_json_from())["type"])
        self.assertTrue({"message", "notification"} <= vues)
        await self.fermer_tout()

    async def test_un_client_ne_lit_ni_n_ecrit_dans_la_conversation_d_un_autre(self):
        conv_b = await database_sync_to_async(services.conversation_du_client)(self.client_b)
        message_b = (await database_sync_to_async(services.envoyer_message)(conv_b, self.membre, texte="Pour B"))[0]
        ws_a = await self.connecter(self.client_a)
        for trame in ({"type": "lu", "jusqu_a": message_b.pk, "conversation": conv_b.pk},
                      {"type": "ecrit", "conversation": conv_b.pk}):
            await ws_a.send_json_to(trame)
            erreur = await ws_a.receive_json_from()
            self.assertEqual(erreur["type"], "erreur", trame)
        message_b = await database_sync_to_async(Message.objects.get)(pk=message_b.pk)
        self.assertIsNone(message_b.lu_le)  # le message de B n'a pas été marqué lu par A
        await self.fermer_tout()


class _Simple(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()


@override_settings(ALLOWED_HOSTS=["api.exemple.cm"], CORS_ALLOWED_ORIGINS=["https://site.exemple.cm"], DEBUG=False)
class OrigineTests(TransactionTestCase):
    async def tenter(self, origine):
        en_tetes = [(b"origin", origine.encode())] if origine else []
        com = WebsocketCommunicator(valider_origine(_Simple.as_asgi()), "/ws/", headers=en_tetes)
        ok, _ = await com.connect()
        if ok:
            await com.disconnect()
        return ok

    async def test_origines_autorisees(self):
        self.assertTrue(await self.tenter("https://site.exemple.cm"))
        self.assertTrue(await self.tenter("http://api.exemple.cm"))

    async def test_origines_refusees(self):
        for origine in ("https://pirate.exemple", "https://site.exemple.cm.pirate.exemple", "http://site.exemple.cm:81",
                        "null", "", None):
            with self.subTest(origine=origine):
                self.assertFalse(await self.tenter(origine))
