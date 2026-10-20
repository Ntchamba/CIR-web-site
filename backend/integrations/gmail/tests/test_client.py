"""Tests du client Gmail : réseau toujours simulé."""
import base64
import email
from email import policy
from unittest import TestCase, mock

import requests
from django.utils.safestring import mark_safe

from integrations.gmail import client
from integrations.gmail.client import MessageEmail
from integrations.gmail.erreurs import (GmailErreurDefinitive, GmailErreurTemporaire,
                                        GmailNonConfigure)

ENV = {"GMAIL_CLIENT_ID": "id-test", "GMAIL_CLIENT_SECRET": "SECRET-TEST-XYZ",
       "GMAIL_REFRESH_TOKEN": "REFRESH-TEST-XYZ", "GMAIL_EXPEDITEUR": "contact@exemple.test"}


def rep(code=200, json=None):
    r = mock.Mock()
    r.status_code = code
    r.json.return_value = json if json is not None else {}
    return r


def reponses_ok():
    """Simule jeton puis envoi, selon l'URL."""
    def post(url, **kw):
        if url == client.URL_JETON:
            return rep(200, {"access_token": "ACCES-TEST", "expires_in": 3600})
        return rep(200, {"id": "msg-42"})
    return post


class Base(TestCase):
    def setUp(self):
        p = mock.patch.dict("os.environ", ENV, clear=True)
        p.start()
        self.addCleanup(p.stop)
        client.vider_cache()
        self.addCleanup(client.vider_cache)

    def msg(self, **kw):
        base = dict(destinataire="client@exemple.test", sujet="Sujet", texte="Texte")
        base.update(kw)
        return MessageEmail(**base)


class EnvoiTests(Base):
    def test_configure(self):
        self.assertTrue(client.configure())
        with mock.patch.dict("os.environ", {"GMAIL_EXPEDITEUR": ""}):
            self.assertFalse(client.configure())

    def test_non_configure(self):
        with mock.patch.dict("os.environ", {}, clear=True), \
                mock.patch("integrations.gmail.client.requests.post") as post:
            with self.assertRaises(GmailNonConfigure):
                client.envoyer(self.msg())
            post.assert_not_called()

    def test_mime_multilingue(self):
        m = self.msg(sujet="Devis résine époxy 你好 こんにちは",
                     texte="Bonjour é à ü 张伟 日本語", html="<p>Bonjour é 张伟 日本語</p>",
                     repondre_a="equipe@exemple.test", nom_expediteur="CIR Révélation",
                     entetes={"List-Unsubscribe": "<https://exemple.test/stop>"})
        with mock.patch("integrations.gmail.client.requests.post", side_effect=reponses_ok()) as post:
            self.assertEqual(client.envoyer(m), "msg-42")
        appel = post.call_args_list[-1]
        self.assertEqual(appel.args[0], client.URL_ENVOI)
        self.assertEqual(appel.kwargs["timeout"], 15)
        self.assertEqual(appel.kwargs["headers"]["Authorization"], "Bearer ACCES-TEST")
        brut = base64.urlsafe_b64decode(appel.kwargs["json"]["raw"])
        lu = email.message_from_bytes(brut, policy=policy.default)
        self.assertEqual(lu["Subject"], "Devis résine époxy 你好 こんにちは")
        self.assertEqual(lu["To"], "client@exemple.test")
        self.assertEqual(lu["Reply-To"], "equipe@exemple.test")
        self.assertEqual(lu["List-Unsubscribe"], "<https://exemple.test/stop>")
        self.assertIn("contact@exemple.test", lu["From"])
        self.assertTrue(lu["Message-ID"])
        self.assertTrue(lu["Date"])
        self.assertEqual(lu.get_content_type(), "multipart/alternative")
        parties = list(lu.iter_parts())
        self.assertEqual([p.get_content_type() for p in parties], ["text/plain", "text/html"])
        self.assertEqual(parties[0].get_content_charset(), "utf-8")
        self.assertIn("张伟 日本語", parties[0].get_content())
        self.assertIn("张伟 日本語", parties[1].get_content())

    def test_sans_html(self):
        with mock.patch("integrations.gmail.client.requests.post", side_effect=reponses_ok()) as post:
            client.envoyer(self.msg())
        brut = base64.urlsafe_b64decode(post.call_args_list[-1].kwargs["json"]["raw"])
        lu = email.message_from_bytes(brut, policy=policy.default)
        self.assertEqual(lu.get_content_type(), "text/plain")

    def test_injection_entetes_refusee(self):
        mauvais = [dict(sujet="a\r\nBcc: x@y.z"), dict(sujet="a\nb"),
                   dict(destinataire="a@b.c\r\nBcc: x@y.z"), dict(repondre_a="a@b.c\nX: y"),
                   dict(nom_expediteur="CIR\r\nBcc: x@y.z"),
                   dict(entetes={"X-A": "v\r\nBcc: x@y.z"}), dict(entetes={"X-A\r\nBcc": "v"})]
        for kw in mauvais:
            with self.subTest(kw=kw), \
                    mock.patch("integrations.gmail.client.requests.post") as post:
                with self.assertRaises(GmailErreurDefinitive):
                    client.envoyer(self.msg(**kw))
                post.assert_not_called()

    def test_destinataire_invalide(self):
        with self.assertRaises(GmailErreurDefinitive):
            client.envoyer(self.msg(destinataire="pas-une-adresse"))


class JetonTests(Base):
    def test_jeton_mis_en_cache(self):
        with mock.patch("integrations.gmail.client.requests.post", side_effect=reponses_ok()) as post:
            client.envoyer(self.msg())
            client.envoyer(self.msg())
        urls = [c.args[0] for c in post.call_args_list]
        self.assertEqual(urls.count(client.URL_JETON), 1)
        self.assertEqual(urls.count(client.URL_ENVOI), 2)
        donnees = post.call_args_list[0].kwargs["data"]
        self.assertEqual(donnees["grant_type"], "refresh_token")
        self.assertEqual(post.call_args_list[0].kwargs["timeout"], 15)

    def test_expiration(self):
        temps = [1000.0]
        with mock.patch("integrations.gmail.client.time.time", side_effect=lambda: temps[0]), \
                mock.patch("integrations.gmail.client.requests.post", side_effect=reponses_ok()) as post:
            client.envoyer(self.msg())
            temps[0] = 1000 + 3600 - 61  # encore valable
            client.envoyer(self.msg())
            self.assertEqual([c.args[0] for c in post.call_args_list].count(client.URL_JETON), 1)
            temps[0] = 1000 + 3600 - 59  # moins de 60 s avant l'expiration
            client.envoyer(self.msg())
            self.assertEqual([c.args[0] for c in post.call_args_list].count(client.URL_JETON), 2)

    def test_erreurs_jeton(self):
        cas = [(400, GmailErreurDefinitive), (401, GmailErreurDefinitive),
               (429, GmailErreurTemporaire), (503, GmailErreurTemporaire)]
        for code, attendue in cas:
            with self.subTest(code=code), \
                    mock.patch("integrations.gmail.client.requests.post", return_value=rep(code)):
                with self.assertRaises(attendue):
                    client.envoyer(self.msg())

    def test_reseau_jeton(self):
        with mock.patch("integrations.gmail.client.requests.post",
                        side_effect=requests.ConnectionError("boom")):
            with self.assertRaises(GmailErreurTemporaire):
                client.envoyer(self.msg())


class ErreursEnvoiTests(Base):
    def _post(self, reponse_envoi):
        def post(url, **kw):
            if url == client.URL_JETON:
                return rep(200, {"access_token": "ACCES-TEST", "expires_in": 3600})
            if isinstance(reponse_envoi, Exception):
                raise reponse_envoi
            return reponse_envoi
        return post

    def test_codes(self):
        cas = [(429, GmailErreurTemporaire), (500, GmailErreurTemporaire), (503, GmailErreurTemporaire),
               (400, GmailErreurDefinitive), (401, GmailErreurDefinitive), (403, GmailErreurDefinitive)]
        for code, attendue in cas:
            client.vider_cache()
            with self.subTest(code=code), mock.patch("integrations.gmail.client.requests.post",
                                                     side_effect=self._post(rep(code))):
                with self.assertRaises(attendue):
                    client.envoyer(self.msg())

    def test_reseau_et_delai(self):
        for exc in (requests.ConnectionError("x"), requests.Timeout("x")):
            client.vider_cache()
            with self.subTest(exc=type(exc).__name__), mock.patch(
                    "integrations.gmail.client.requests.post", side_effect=self._post(exc)):
                with self.assertRaises(GmailErreurTemporaire):
                    client.envoyer(self.msg())

    def test_401_vide_le_cache(self):
        with mock.patch("integrations.gmail.client.requests.post", side_effect=self._post(rep(401))) as post:
            with self.assertRaises(GmailErreurDefinitive):
                client.envoyer(self.msg())
        with mock.patch("integrations.gmail.client.requests.post", side_effect=reponses_ok()) as post:
            client.envoyer(self.msg())
        self.assertIn(client.URL_JETON, [c.args[0] for c in post.call_args_list])

    def test_reponse_sans_identifiant(self):
        with mock.patch("integrations.gmail.client.requests.post",
                        side_effect=self._post(rep(200, {}))):
            with self.assertRaises(GmailErreurTemporaire):
                client.envoyer(self.msg())

    def test_aucune_fuite_de_secret(self):
        secrets = ["SECRET-TEST-XYZ", "REFRESH-TEST-XYZ", "ACCES-TEST", "id-test"]
        exceptions = [requests.ConnectionError("SECRET-TEST-XYZ REFRESH-TEST-XYZ ACCES-TEST")]
        with self.assertLogs("integrations.gmail.client", level="DEBUG") as logs:
            client.journal.debug("démarrage")  # garantit au moins une trace pour assertLogs
            for code in (400, 401, 403, 429, 500):
                client.vider_cache()
                with mock.patch("integrations.gmail.client.requests.post",
                                side_effect=self._post(rep(code, {"error": "SECRET-TEST-XYZ"}))):
                    with self.assertRaises(Exception) as ctx:
                        client.envoyer(self.msg())
                    for s in secrets:
                        self.assertNotIn(s, str(ctx.exception))
                        self.assertIsNone(ctx.exception.__cause__)
            for exc in exceptions:
                client.vider_cache()
                with mock.patch("integrations.gmail.client.requests.post", side_effect=self._post(exc)):
                    with self.assertRaises(Exception) as ctx:
                        client.envoyer(self.msg())
                    for s in secrets:
                        self.assertNotIn(s, str(ctx.exception))
                        self.assertTrue(ctx.exception.__suppress_context__)  # cause réseau masquée
        for s in secrets:
            self.assertNotIn(s, "\n".join(logs.output))


class GabaritsTests(TestCase):
    def test_rendu(self):
        texte, html = client.rendre_gabarit(
            titre="Nouveau message", corps_texte="Bonjour 张伟", corps_html=mark_safe("<p>Bonjour 张伟</p>"),
            lien="https://revelation-sarl.com/x?a=1&b=2", libelle_lien="Ouvrir", pied="CIR, Douala",
            lien_desabonnement="https://revelation-sarl.com/stop")
        for couleur in ("#0E2A38", "#1177A8", "#FF6D4C", "#F3F7F9"):
            self.assertIn(couleur, html)
        self.assertIn('width="600"', html)
        self.assertIn("<p>Bonjour 张伟</p>", html)
        self.assertIn("Nouveau message", texte)
        self.assertIn("Ouvrir : https://revelation-sarl.com/x?a=1&b=2", texte)
        self.assertIn("https://revelation-sarl.com/stop", texte)
        self.assertNotIn("<", texte)

    def test_echappement(self):
        texte, html = client.rendre_gabarit(
            titre="<script>alert(1)</script>", corps_html="<img src=x onerror=alert(1)>",
            corps_texte="<b>gras</b>", pied='"><i>')
        self.assertNotIn("<script>", html)
        self.assertNotIn("<img", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("&lt;img", html)
        self.assertIn("<b>gras</b>", texte)  # texte brut : pas d'HTML, aucun échappement parasite

    def test_sans_lien(self):
        texte, html = client.rendre_gabarit(titre="T", corps_texte="C", corps_html="C")
        self.assertNotIn("<a href", html)
        self.assertNotIn("None", texte + html)
