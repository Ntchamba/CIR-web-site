"""Tests du client Gemini : réseau toujours simulé."""
import socket
from unittest import TestCase, mock

import requests

from integrations.gemini import client
from integrations.gemini.client import AppelOutil, Reponse
from integrations.gemini.erreurs import (GeminiContenuBloque, GeminiErreurDefinitive,
                                         GeminiErreurTemporaire, GeminiNonConfigure)
from integrations.gemini.outils import declarer

CLE = "CLE-SECRETE-GEMINI-XYZ"
ENV = {"GEMINI_API_KEY": CLE}
TEXTE_UTILISATEUR = "Mon texte confidentiel ZEBRE-42"
MSG = [{"role": "user", "texte": TEXTE_UTILISATEUR}]


def rep(code=200, json=None, illisible=False):
    r = mock.Mock()
    r.status_code = code
    if illisible:
        r.json.side_effect = ValueError("pas du JSON")
    else:
        r.json.return_value = json if json is not None else {}
    return r


def candidate(parties, fin="STOP", usage=(10, 5)):
    return {"candidates": [{"content": {"role": "model", "parts": parties}, "finishReason": fin}],
            "usageMetadata": {"promptTokenCount": usage[0], "candidatesTokenCount": usage[1]}}


class Base(TestCase):
    def setUp(self):
        p = mock.patch.dict("os.environ", ENV, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def poster(self, reponse):
        p = mock.patch("integrations.gemini.client.requests.post", return_value=reponse)
        self.post = p.start()
        self.addCleanup(p.stop)

    def generer(self, **kw):
        kw.setdefault("modele", "gemini-2.5-flash")
        kw.setdefault("instruction", "Tu es l'assistant de CIR.")
        kw.setdefault("messages", MSG)
        return client.generer(**kw)


class AucunReseauTests(TestCase):
    def test_socket_bloque(self):
        def interdit(*a, **kw):
            raise AssertionError("Appel réseau réel interdit dans les tests.")
        with mock.patch.object(socket, "socket", interdit), \
                mock.patch.dict("os.environ", ENV, clear=True), \
                mock.patch("integrations.gemini.client.requests.post",
                           return_value=rep(200, candidate([{"text": "Bonjour"}]))):
            r = client.generer(modele="gemini-2.5-flash", instruction="x", messages=MSG)
        self.assertEqual(r.texte, "Bonjour")


class ConfigurationTests(Base):
    def test_configure(self):
        self.assertTrue(client.configure())
        with mock.patch.dict("os.environ", {"GEMINI_API_KEY": " "}):
            self.assertFalse(client.configure())
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertFalse(client.configure())

    def test_non_configure_sans_appel(self):
        self.poster(rep())
        with mock.patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(GeminiNonConfigure):
                self.generer()
        self.post.assert_not_called()


class RequeteTests(Base):
    def test_adresse_en_tetes_et_corps(self):
        self.poster(rep(200, candidate([{"text": "Bonjour"}])))
        outil = declarer("chercher_produits", "Cherche.", {"q": {"type": "string", "description": "mot"}})
        self.generer(outils=[outil], temperature=0.1, jetons_max=300, delai=12)
        args, kw = self.post.call_args
        self.assertEqual(args[0], "https://generativelanguage.googleapis.com/v1beta/models/"
                                  "gemini-2.5-flash:generateContent")
        self.assertNotIn(CLE, args[0])
        self.assertEqual(kw["headers"]["x-goog-api-key"], CLE)
        self.assertEqual(kw["timeout"], 12)
        corps = kw["json"]
        self.assertNotIn(CLE, str(corps))
        self.assertEqual(corps["systemInstruction"], {"parts": [{"text": "Tu es l'assistant de CIR."}]})
        self.assertEqual(corps["contents"], [{"role": "user", "parts": [{"text": TEXTE_UTILISATEUR}]}])
        self.assertEqual(corps["tools"], [{"functionDeclarations": [outil]}])
        self.assertEqual(corps["toolConfig"], {"functionCallingConfig": {"mode": "AUTO"}})
        self.assertEqual(corps["generationConfig"], {"temperature": 0.1, "maxOutputTokens": 300})
        self.assertEqual(len(corps["safetySettings"]), 4)
        self.assertTrue(all(s["threshold"] == "BLOCK_MEDIUM_AND_ABOVE" for s in corps["safetySettings"]))

    def test_sans_outils_pas_de_tools(self):
        self.poster(rep(200, candidate([{"text": "ok"}])))
        self.generer()
        corps = self.post.call_args.kwargs["json"]
        self.assertNotIn("tools", corps)
        self.assertNotIn("toolConfig", corps)

    def test_historique_avec_appel_et_resultat(self):
        self.poster(rep(200, candidate([{"text": "ok"}])))
        self.generer(messages=[
            {"role": "user", "texte": "Quels produits ?"},
            {"role": "model", "appel": {"nom": "chercher_produits", "arguments": {"q": "sol"}}},
            {"role": "function", "resultat": {"nom": "chercher_produits", "contenu": [{"nom": "A"}]}},
            {"role": "model", "texte": "Voici."}])
        contenus = self.post.call_args.kwargs["json"]["contents"]
        self.assertEqual(contenus[1], {"role": "model", "parts": [
            {"functionCall": {"name": "chercher_produits", "args": {"q": "sol"}}}]})
        self.assertEqual(contenus[2]["parts"][0]["functionResponse"]["name"], "chercher_produits")
        self.assertEqual(contenus[3]["role"], "model")

    def test_modele_invalide(self):
        self.poster(rep())
        for modele in ("../x", "GEMINI", "a", "gemini 2", "gemini/2.5", "", None, "m" * 70):
            with self.assertRaises(GeminiErreurDefinitive, msg=repr(modele)):
                self.generer(modele=modele)
        self.post.assert_not_called()

    def test_messages_invalides(self):
        self.poster(rep())
        for messages in ([], [{"role": "system", "texte": "x"}], [{"role": "user"}],
                         [{"role": "user", "appel": {"nom": "abc"}}],
                         [{"role": "model", "resultat": {"nom": "abc", "contenu": 1}}], ["texte"]):
            with self.assertRaises(GeminiErreurDefinitive, msg=repr(messages)):
                self.generer(messages=messages)
        self.post.assert_not_called()


class ReponseTests(Base):
    def test_texte_et_jetons(self):
        self.poster(rep(200, candidate([{"text": "Bon"}, {"text": "jour"}], usage=(120, 30))))
        r = self.generer()
        self.assertEqual(r, Reponse(texte="Bonjour", appels=[], jetons_entree=120, jetons_sortie=30,
                                    raison_fin="STOP"))

    def test_appel_de_fonction_renvoye_sans_execution(self):
        self.poster(rep(200, candidate([{"functionCall": {"name": "chercher_produits",
                                                          "args": {"q": "sol"}}}])))
        r = self.generer()
        self.assertEqual(r.texte, "")
        self.assertEqual(r.appels, [AppelOutil(nom="chercher_produits", arguments={"q": "sol"})])
        self.assertEqual(self.post.call_count, 1)  # aucun second appel : rien n'est exécuté

    def test_reponse_mixte(self):
        self.poster(rep(200, candidate([{"text": "Je regarde."},
                                        {"functionCall": {"name": "outil_a"}},
                                        {"functionCall": {"name": "outil_b", "args": {"n": 2}}}])))
        r = self.generer()
        self.assertEqual(r.texte, "Je regarde.")
        self.assertEqual([a.nom for a in r.appels], ["outil_a", "outil_b"])
        self.assertEqual(r.appels[0].arguments, {})

    def test_pensee_ignoree(self):
        self.poster(rep(200, candidate([{"text": "réflexion", "thought": True}, {"text": "Réponse"}])))
        self.assertEqual(self.generer().texte, "Réponse")

    def test_jetons_absents(self):
        self.poster(rep(200, {"candidates": [{"content": {"parts": [{"text": "a"}]}}]}))
        r = self.generer()
        self.assertEqual((r.jetons_entree, r.jetons_sortie, r.raison_fin), (0, 0, ""))

    def test_fin_longueur_sans_texte(self):
        self.poster(rep(200, candidate([], fin="MAX_TOKENS")))
        r = self.generer()
        self.assertEqual((r.texte, r.appels, r.raison_fin), ("", [], "MAX_TOKENS"))


class BloqueTests(Base):
    def test_requete_bloquee(self):
        self.poster(rep(200, {"promptFeedback": {"blockReason": "SAFETY"}}))
        with self.assertRaises(GeminiContenuBloque):
            self.generer()

    def test_aucune_candidate(self):
        for donnees in ({}, {"candidates": []}):
            self.poster(rep(200, donnees))
            with self.assertRaises(GeminiContenuBloque):
                self.generer()

    def test_reponse_bloquee_par_securite(self):
        for fin in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"):
            self.poster(rep(200, {"candidates": [{"finishReason": fin}]}))
            with self.assertRaises(GeminiContenuBloque, msg=fin):
                self.generer()


class ErreursTests(Base):
    def test_temporaires(self):
        for code in (429, 500, 503):
            self.poster(rep(code, {"error": {"message": TEXTE_UTILISATEUR + CLE}}))
            with self.assertRaises(GeminiErreurTemporaire, msg=code):
                self.generer()

    def test_definitives(self):
        for code in (400, 401, 403, 404):
            self.poster(rep(code, {"error": {"message": TEXTE_UTILISATEUR + CLE}}))
            with self.assertRaises(GeminiErreurDefinitive, msg=code):
                self.generer()

    def test_reseau_et_delai(self):
        for exc in (requests.ConnectionError(f"{CLE} {TEXTE_UTILISATEUR}"),
                    requests.Timeout(f"https://x?key={CLE}")):
            with mock.patch("integrations.gemini.client.requests.post", side_effect=exc):
                with self.assertRaises(GeminiErreurTemporaire) as ctx:
                    self.generer()
            self.assertIsNone(ctx.exception.__cause__)
            self.assertTrue(ctx.exception.__suppress_context__)

    def test_reponse_illisible(self):
        self.poster(rep(200, illisible=True))
        with self.assertRaises(GeminiErreurTemporaire):
            self.generer()

    def test_structures_inattendues(self):
        for donnees in ([], {"candidates": ["x"]}, {"candidates": [{"content": {"parts": "x"}}]},
                        {"candidates": [{"content": {"parts": ["x"]}}]},
                        {"candidates": [{"content": {"parts": [{"functionCall": {"args": {}}}]}}]},
                        {"candidates": [{"content": {"parts": [{"functionCall": {"name": "a", "args": 3}}]}}]}):
            self.poster(rep(200, donnees))
            with self.assertRaises(GeminiErreurTemporaire, msg=repr(donnees)):
                self.generer()


class SecretsTests(Base):
    def _verifier(self, exc):
        texte = f"{exc} {exc!r} {exc.args}"
        self.assertNotIn(CLE, texte)
        self.assertNotIn("ZEBRE-42", texte)

    def test_aucun_secret_dans_les_erreurs(self):
        scenarios = [rep(429, {"e": CLE + TEXTE_UTILISATEUR}), rep(400, {"e": CLE + TEXTE_UTILISATEUR}),
                     rep(403, {"e": CLE}), rep(200, {"promptFeedback": {"blockReason": TEXTE_UTILISATEUR}}),
                     rep(200, {"candidates": [{"finishReason": "SAFETY"}]}), rep(200, illisible=True)]
        for r in scenarios:
            self.poster(r)
            with self.assertRaises(Exception) as ctx:
                self.generer()
            self._verifier(ctx.exception)
        with mock.patch("integrations.gemini.client.requests.post",
                        side_effect=requests.ConnectionError(CLE + TEXTE_UTILISATEUR)):
            with self.assertRaises(GeminiErreurTemporaire) as ctx:
                self.generer()
            self._verifier(ctx.exception)

    def test_aucun_secret_dans_les_journaux(self):
        self.poster(rep(200, candidate([{"text": "Réponse " + TEXTE_UTILISATEUR}])))
        with self.assertLogs("integrations.gemini", level="DEBUG") as cm:
            self.generer()
        sortie = "\n".join(cm.output)
        self.assertNotIn(CLE, sortie)
        self.assertNotIn("ZEBRE-42", sortie)
        self.assertIn("gemini-2.5-flash", sortie)

    def test_aucun_secret_dans_les_journaux_en_erreur(self):
        self.poster(rep(500, {"e": CLE}))
        with self.assertNoLogs("integrations.gemini", level="DEBUG"):
            with self.assertRaises(GeminiErreurTemporaire):
                self.generer()
