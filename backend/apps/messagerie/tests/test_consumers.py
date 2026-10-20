"""WebSocket /ws/ : authentification par la première trame, messagerie, présence, isolation."""
import asyncio
import json
from datetime import timedelta
from unittest import mock

from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.catalogue.tests.outils import MDP, creer_client, creer_membre
from apps.messagerie import services
from apps.messagerie.consumers import ConsommateurDirect
from apps.messagerie.models import Message
from apps.noyau import presence


def jeton(utilisateur):
    return str(AccessToken.for_user(utilisateur))


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
                   CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class DirectTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.client_a = creer_client("a@exemple.cm", "Alice Client")
        self.client_b = creer_client("b@exemple.cm", "Bruno Client")
        self.membre = creer_membre()
        self.ouverts = []

    async def connecter(self, utilisateur=None, authentifier=True, headers=None):
        com = WebsocketCommunicator(ConsommateurDirect.as_asgi(), "/ws/", headers=headers or [])
        self.ouverts.append(com)
        ok, _ = await com.connect()
        self.assertTrue(ok)
        if utilisateur is not None and authentifier:
            await com.send_json_to({"type": "authentifier", "jeton": await database_sync_to_async(jeton)(utilisateur)})
            pret = await com.receive_json_from()
            self.assertEqual(pret["type"], "pret")
        return com

    async def fermer_tout(self):
        for com in self.ouverts:
            try:
                await com.disconnect()
            except Exception:  # noqa: BLE001
                pass

    async def attendre(self, com, type_trame):
        """Prochaine trame du type demandé (les compteurs `non_lus` peuvent arriver avant)."""
        for _ in range(10):
            trame = await com.receive_json_from()
            if trame["type"] == type_trame:
                return trame
        self.fail(f"Aucune trame {type_trame}")

    async def silence(self, com, delai=0.2):
        self.assertTrue(await com.receive_nothing(timeout=delai))

    async def test_pret_apres_authentification(self):
        com = await self.connecter()
        await com.send_json_to({"type": "authentifier", "jeton": jeton(self.client_a)})
        pret = await com.receive_json_from()
        self.assertEqual(pret, {"type": "pret", "utilisateur": {"id": self.client_a.pk, "role": "client"},
                                "non_lus": 0, "notifications_non_lues": 0})
        await self.fermer_tout()

    async def test_l_equipe_recoit_aussi_pret(self):
        com = await self.connecter(self.membre, authentifier=False)
        await com.send_json_to({"type": "authentifier", "jeton": jeton(self.membre)})
        pret = await com.receive_json_from()
        self.assertEqual((pret["type"], pret["utilisateur"]["role"]), ("pret", "membre"))
        await self.fermer_tout()

    async def test_sans_authentification_dans_les_5_secondes(self):
        with mock.patch.object(ConsommateurDirect, "DELAI_AUTHENTIFICATION", 0.1):
            com = await self.connecter()
            erreur = await com.receive_json_from()
            self.assertEqual((erreur["type"], erreur["code"]), ("erreur", "non_authentifie"))
            sortie = await com.receive_output()
            self.assertEqual((sortie["type"], sortie["code"]), ("websocket.close", 4401))
        self.assertEqual(ConsommateurDirect.DELAI_AUTHENTIFICATION, 5)
        await self.fermer_tout()

    async def test_jeton_invalide_expire_ou_compte_inactif(self):
        expire = AccessToken.for_user(self.client_a)
        expire.set_exp(lifetime=-timedelta(seconds=10))
        inactif = await database_sync_to_async(creer_client)("off@exemple.cm", "Off")
        jeton_inactif = jeton(inactif)
        inactif.is_active = False
        await database_sync_to_async(inactif.save)()
        for valeur in ("n'importe quoi", str(expire), jeton_inactif, "", None, 12):
            with self.subTest(jeton=valeur):
                com = await self.connecter()
                await com.send_json_to({"type": "authentifier", "jeton": valeur})
                erreur = await com.receive_json_from()
                self.assertEqual(erreur["code"], "non_authentifie")
                self.assertEqual((await com.receive_output())["code"], 4401)

    async def test_une_trame_avant_l_authentification_ferme(self):
        com = await self.connecter()
        await com.send_json_to({"type": "ping"})
        self.assertEqual((await com.receive_json_from())["code"], "non_authentifie")
        self.assertEqual((await com.receive_output())["code"], 4401)
        await self.fermer_tout()

    async def test_trame_trop_grosse_ferme_en_4413(self):
        com = await self.connecter(self.client_a)
        await com.send_to(text_data=json.dumps({"type": "envoyer", "texte": "x" * 20000}))
        self.assertEqual((await com.receive_output())["code"], 4413)

    async def test_format_invalide_ne_ferme_pas(self):
        com = await self.connecter(self.client_a)
        for brut in ("pas du json", "[1, 2]", json.dumps({"sans": "type"}), json.dumps({"type": "inconnu"})):
            await com.send_to(text_data=brut)
            self.assertEqual((await com.receive_json_from())["code"], "format_invalide")
        await com.send_json_to({"type": "ping"})
        self.assertEqual((await com.receive_json_from())["type"], "pong")
        await self.fermer_tout()

    async def test_ping_maintient_la_presence(self):
        com = await self.connecter(self.membre)
        self.assertEqual(await database_sync_to_async(presence.equipe_en_ligne)(), 1)
        cache.clear()
        await com.send_json_to({"type": "ping"})
        self.assertEqual(await com.receive_json_from(), {"type": "pong"})
        self.assertEqual(await database_sync_to_async(presence.equipe_en_ligne)(), 1)
        await self.fermer_tout()

    async def test_le_client_envoie_et_l_equipe_recoit(self):
        client_ws = await self.connecter(self.client_a)
        equipe_ws = await self.connecter(self.membre)
        autre_ws = await self.connecter(self.client_b)
        await client_ws.send_json_to({"type": "envoyer", "texte": "Bonjour", "cle_client": "c1"})
        recu = await self.attendre(equipe_ws, "message")
        self.assertEqual((recu["type"], recu["message"]["texte"], recu["message"]["cle_client"]),
                         ("message", "Bonjour", "c1"))
        # le client reçoit sa propre confirmation (repérée par cle_client)
        confirmation = await self.attendre(client_ws, "message")
        self.assertEqual(confirmation["message"]["cle_client"], "c1")
        # isolation : l'autre client ne reçoit rien
        await self.silence(autre_ws)
        self.assertEqual(await database_sync_to_async(Message.objects.count)(), 1)
        await self.fermer_tout()

    async def test_l_equipe_repond_au_bon_client(self):
        conversation = await database_sync_to_async(services.conversation_du_client)(self.client_a)
        client_ws = await self.connecter(self.client_a)
        autre_ws = await self.connecter(self.client_b)
        equipe_ws = await self.connecter(self.membre)
        await equipe_ws.send_json_to({"type": "envoyer", "texte": "Réponse", "conversation": conversation.pk})
        trame = await self.attendre(client_ws, "message")
        self.assertEqual((trame["type"], trame["message"]["auteur_role"]), ("message", "equipe"))
        await self.silence(autre_ws)
        await self.fermer_tout()

    async def test_erreurs_d_envoi(self):
        conversation = await database_sync_to_async(services.conversation_du_client)(self.client_b)
        client_ws = await self.connecter(self.client_a)
        cas = [
            ({"texte": "  ", "cle_client": "v"}, "message_vide"),
            ({"texte": "x" * 2001, "cle_client": "l"}, "trop_long"),
            ({"texte": "a", "cle_client": "i", "conversation": conversation.pk}, "interdit"),
            ({"texte": 12, "cle_client": "f"}, "format_invalide"),
            ({"texte": "a", "cle_client": "c", "commande": "abc"}, "format_invalide"),
        ]
        for donnees, code in cas:
            with self.subTest(code=code):
                await client_ws.send_json_to({"type": "envoyer", **donnees})
                erreur = await client_ws.receive_json_from()
                self.assertEqual((erreur["type"], erreur["code"]), ("erreur", code))
                self.assertTrue(erreur["detail"])
                if isinstance(donnees["texte"], str):
                    self.assertEqual(erreur["cle_client"], donnees["cle_client"])  # le front repère son message
        equipe_ws = await self.connecter(self.membre)
        await equipe_ws.send_json_to({"type": "envoyer", "texte": "sans conversation"})
        self.assertEqual((await equipe_ws.receive_json_from())["code"], "conversation_inconnue")
        await equipe_ws.send_json_to({"type": "envoyer", "texte": "x", "conversation": 99999})
        self.assertEqual((await equipe_ws.receive_json_from())["code"], "conversation_inconnue")
        self.assertEqual(await database_sync_to_async(Message.objects.count)(), 0)
        await self.fermer_tout()

    async def test_quota_par_websocket(self):
        client_ws = await self.connecter(self.client_a)
        for i in range(30):
            await client_ws.send_json_to({"type": "envoyer", "texte": f"m{i}"})
        while not await client_ws.receive_nothing(timeout=0.3):
            await client_ws.receive_json_from()
        await client_ws.send_json_to({"type": "envoyer", "texte": "de trop", "cle_client": "z"})
        erreur = await client_ws.receive_json_from()
        self.assertEqual((erreur["code"], erreur["cle_client"]), ("trop_de_messages", "z"))
        await self.fermer_tout()

    async def test_accuse_de_lecture(self):
        conversation = await database_sync_to_async(services.conversation_du_client)(self.client_a)
        message = (await database_sync_to_async(services.envoyer_message)(conversation, self.membre, texte="Salut"))[0]
        client_ws = await self.connecter(self.client_a)
        equipe_ws = await self.connecter(self.membre)
        await client_ws.send_json_to({"type": "lu", "jusqu_a": message.pk})
        trame = await equipe_ws.receive_json_from()
        while trame["type"] != "lu":
            trame = await equipe_ws.receive_json_from()
        self.assertEqual(trame, {"type": "lu", "conversation": conversation.pk, "par": "client",
                                 "jusqu_a": message.pk})
        await client_ws.send_json_to({"type": "lu", "jusqu_a": "abc"})
        while True:
            erreur = await client_ws.receive_json_from()
            if erreur["type"] == "erreur":
                break
        self.assertEqual(erreur["code"], "format_invalide")
        await self.fermer_tout()

    async def test_ecrit_limite_a_une_trame_toutes_les_3_secondes(self):
        client_ws = await self.connecter(self.client_a)
        equipe_ws = await self.connecter(self.membre)
        for _ in range(3):
            await client_ws.send_json_to({"type": "ecrit"})
        premier = await equipe_ws.receive_json_from()
        self.assertEqual((premier["type"], premier["par"]), ("ecrit", "client"))
        await self.silence(equipe_ws, 0.3)  # les suivantes sont ignorées
        await self.fermer_tout()

    async def test_langue_du_compte_pour_les_erreurs(self):
        await database_sync_to_async(lambda: setattr(self.client_a, "langue", "en") or self.client_a.save())()
        client_ws = await self.connecter(self.client_a)
        await client_ws.send_json_to({"type": "envoyer", "texte": " "})
        erreur = await client_ws.receive_json_from()
        self.assertEqual(erreur["detail"], "Write a message or attach a file.")
        await self.fermer_tout()

    async def test_publication_des_autres_modules(self):
        from apps.noyau import direct

        client_ws = await self.connecter(self.client_a)
        equipe_ws = await self.connecter(self.membre)
        await database_sync_to_async(direct.publier_utilisateur)(self.client_a.pk, "notification", {"notification": {"id": 1}})
        await database_sync_to_async(direct.publier_equipe)("appel_entrant", {"appel": {"id": 2}})
        self.assertEqual((await client_ws.receive_json_from())["type"], "notification")
        self.assertEqual((await equipe_ws.receive_json_from())["type"], "appel_entrant")
        await self.silence(client_ws)  # le client ne reçoit pas les trames de l'équipe
        await self.fermer_tout()
