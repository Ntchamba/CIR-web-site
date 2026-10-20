from django.test import override_settings
"""Tests du client CamPay : réseau toujours simulé."""
import socket
from unittest import TestCase, mock

import requests

from integrations.campay import client
from integrations.campay.client import Collecte, Transaction
from integrations.campay.erreurs import (CampayErreurDefinitive, CampayErreurTemporaire,
                                         CampayNonConfigure)

ENV = {"CAMPAY_USERNAME": "UTILISATEUR-TEST", "CAMPAY_PASSWORD": "MOTDEPASSE-SECRET-XYZ",
       "CAMPAY_BASE_URL": "https://campay.test/api"}
REF = "cir-0123456789abcdef01234567"
UUID = "11111111-2222-3333-4444-555555555555"
SECRETS = ("MOTDEPASSE-SECRET-XYZ", "UTILISATEUR-TEST", "JETON-TEST")


def rep(code=200, json=None, illisible=False):
    r = mock.Mock()
    r.status_code = code
    if illisible:
        r.json.side_effect = ValueError("pas du JSON")
    else:
        r.json.return_value = json if json is not None else {}
    return r


def jeton(valeur="JETON-TEST", duree=3600):
    return rep(200, {"token": valeur, "expires_in": duree})


class Base(TestCase):
    def setUp(self):
        p = mock.patch.dict("os.environ", ENV, clear=True)
        p.start()
        self.addCleanup(p.stop)
        client.vider_cache()
        self.addCleanup(client.vider_cache)

    def poster(self, *reponses):
        """Remplace requests.post : le jeton est servi automatiquement, le reste dans l'ordre."""
        suite = list(reponses)

        def post(url, **kw):
            if url.endswith("/token/"):
                return jeton()
            return suite.pop(0)
        p = mock.patch("integrations.campay.client.requests.post", side_effect=post)
        self.post = p.start()
        self.addCleanup(p.stop)

    def appels(self, fin):
        return [c for c in self.post.call_args_list if c.args[0].endswith(fin)]


class AucunReseauTests(TestCase):
    def test_socket_bloque(self):
        """Garantit qu'aucun appel réel n'a lieu : toute ouverture de socket échoue."""
        def interdit(*a, **kw):
            raise AssertionError("Appel réseau réel interdit dans les tests.")
        with mock.patch.object(socket, "socket", interdit), \
                mock.patch.dict("os.environ", ENV, clear=True):
            client.vider_cache()
            with mock.patch("integrations.campay.client.requests.post",
                            side_effect=lambda url, **kw: jeton() if url.endswith("/token/")
                            else rep(200, {"reference": UUID})):
                self.assertEqual(client.initier_collecte(
                    montant=1000, telephone="699001122", description="Test",
                    reference_externe=REF).reference, UUID)
        client.vider_cache()


class ConfigurationTests(Base):
    def test_configure(self):
        self.assertTrue(client.configure())
        with mock.patch.dict("os.environ", {"CAMPAY_PASSWORD": " "}):
            self.assertFalse(client.configure())

    def test_non_configure(self):
        with mock.patch.dict("os.environ", {}, clear=True), \
                mock.patch("integrations.campay.client.requests.post") as post, \
                mock.patch("integrations.campay.client.requests.get") as get:
            with self.assertRaises(CampayNonConfigure):
                client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                        reference_externe=REF)
            with self.assertRaises(CampayNonConfigure):
                client.statut(UUID)
            post.assert_not_called()
            get.assert_not_called()

    def test_adresse_de_base_par_defaut(self):
        with mock.patch.dict("os.environ", {"CAMPAY_BASE_URL": ""}):
            self.assertEqual(client._base(), "https://www.campay.net/api")


class JetonTests(Base):
    def test_jeton_en_cache_et_en_tete(self):
        self.poster(rep(200, {"reference": UUID}), rep(200, {"reference": UUID}))
        for _ in range(2):
            client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                    reference_externe=REF)
        self.assertEqual(len(self.appels("/token/")), 1)
        kw = self.appels("/collect/")[0].kwargs
        self.assertEqual(kw["headers"], {"Authorization": "Token JETON-TEST"})
        self.assertEqual(kw["timeout"], 15)
        self.assertEqual(self.appels("/token/")[0].kwargs["json"],
                         {"username": "UTILISATEUR-TEST", "password": "MOTDEPASSE-SECRET-XYZ"})

    def test_expiration_refait_un_jeton(self):
        sequence = [jeton("A", 3600), jeton("B", 3600)]
        with mock.patch("integrations.campay.client.requests.post", side_effect=sequence) as post:
            with mock.patch("integrations.campay.client.time.time", return_value=1000.0):
                self.assertEqual(client._jeton_acces(), "A")
            with mock.patch("integrations.campay.client.time.time", return_value=1000.0 + 3600 - 61):
                self.assertEqual(client._jeton_acces(), "A")
            self.assertEqual(post.call_count, 1)
            with mock.patch("integrations.campay.client.time.time", return_value=1000.0 + 3600 - 59):
                self.assertEqual(client._jeton_acces(), "B")
            self.assertEqual(post.call_count, 2)

    def test_401_vide_le_cache_et_refait_un_essai(self):
        jetons = iter([jeton("VIEUX"), jeton("NEUF")])
        reponses = iter([rep(401), rep(200, {"reference": UUID})])

        def post(url, **kw):
            return next(jetons) if url.endswith("/token/") else next(reponses)
        with mock.patch("integrations.campay.client.requests.post", side_effect=post) as p:
            c = client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                        reference_externe=REF)
        self.assertEqual(c.reference, UUID)
        collectes = [x for x in p.call_args_list if x.args[0].endswith("/collect/")]
        self.assertEqual([x.kwargs["headers"]["Authorization"] for x in collectes],
                         ["Token VIEUX", "Token NEUF"])

    def test_401_persistant_un_seul_nouvel_essai(self):
        self.poster(rep(401), rep(401), rep(200))
        with self.assertRaises(CampayErreurDefinitive) as cm:
            client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                    reference_externe=REF)
        self.assertEqual(cm.exception.code, "refuse")
        self.assertEqual(len(self.appels("/collect/")), 2)

    def test_identifiants_refuses(self):
        with mock.patch("integrations.campay.client.requests.post", return_value=rep(401)):
            with self.assertRaises(CampayErreurDefinitive) as cm:
                client.statut(UUID)
        self.assertEqual(cm.exception.code, "refuse")

    def test_jeton_service_indisponible_ou_illisible(self):
        for r in (rep(503), rep(429), rep(200, {"autre": 1}), rep(200, illisible=True)):
            with mock.patch("integrations.campay.client.requests.post", return_value=r):
                with self.assertRaises(CampayErreurTemporaire):
                    client.statut(UUID)


class CollecteTests(Base):
    def test_collecte(self):
        self.poster(rep(200, {"reference": UUID, "ussd_code": "*126#", "operator": "MTN"}))
        c = client.initier_collecte(montant=15000, telephone="+237 6 99 00 11 22",
                                    description="Commande CMD-1", reference_externe=REF)
        self.assertEqual(c, Collecte(reference=UUID, code_ussd="*126#", operateur="MTN"))
        corps = self.appels("/collect/")[0].kwargs["json"]
        self.assertEqual(corps, {"amount": "15000", "currency": "XAF", "from": "237699001122",
                                 "description": "Commande CMD-1", "external_reference": REF})

    def test_montants_refuses(self):
        for m in (0, -5, 10.5, "1000", True, None):
            with self.assertRaises(CampayErreurDefinitive) as cm:
                client.initier_collecte(montant=m, telephone="699001122", description="x",
                                        reference_externe=REF)
            self.assertEqual(cm.exception.code, "montant_invalide")

    def test_numero_refuse_sans_le_citer(self):
        with self.assertRaises(CampayErreurDefinitive) as cm:
            client.initier_collecte(montant=1000, telephone="+33612345678", description="x",
                                    reference_externe=REF)
        self.assertEqual(cm.exception.code, "numero_invalide")
        self.assertNotIn("12345678", str(cm.exception))

    def test_reference_externe_controlee(self):
        with self.assertRaises(CampayErreurDefinitive):
            client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                    reference_externe="../x")

    def test_400_classe_selon_le_corps(self):
        cas = [({"message": "Invalid phone number"}, "numero_invalide"),
               ({"message": "Invalid amount"}, "montant_invalide"),
               ({"message": "autre"}, "refuse")]
        for corps, code in cas:
            self.poster(rep(400, corps))
            with self.assertRaises(CampayErreurDefinitive) as cm:
                client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                        reference_externe=REF)
            self.assertEqual(cm.exception.code, code)
            self.assertNotIn("Invalid", str(cm.exception))

    def test_erreurs_temporaires(self):
        for r in (rep(429), rep(500), rep(502), rep(200, illisible=True), rep(200, {}),
                  rep(200, {"reference": ""})):
            self.poster(r)
            with self.assertRaises(CampayErreurTemporaire):
                client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                        reference_externe=REF)

    def test_erreur_reseau_et_delai(self):
        for exc in (requests.ConnectionError("MOTDEPASSE-SECRET-XYZ"), requests.Timeout("JETON-TEST")):
            with mock.patch("integrations.campay.client.requests.post",
                            side_effect=lambda url, exc=exc, **kw: jeton() if url.endswith("/token/")
                            else (_ for _ in ()).throw(exc)):
                with self.assertRaises(CampayErreurTemporaire) as cm:
                    client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                            reference_externe=REF)
                self.assertIsNone(cm.exception.__cause__)
                self.assertTrue(cm.exception.__suppress_context__)
                for s in SECRETS:
                    self.assertNotIn(s, str(cm.exception))

    def test_reseau_sur_le_jeton(self):
        with mock.patch("integrations.campay.client.requests.post",
                        side_effect=requests.ConnectionError("x")):
            with self.assertRaises(CampayErreurTemporaire):
                client.statut(UUID)

    def test_aucun_secret_dans_les_erreurs_ni_les_journaux(self):
        with self.assertLogs("integrations.campay", level="DEBUG") as logs:
            client.journal.debug("démarrage")  # assertLogs exige au moins un message
            for r in (rep(400, {"m": "x"}), rep(403), rep(500), rep(404)):
                self.poster(r)
                with self.assertRaises(Exception) as cm:
                    client.initier_collecte(montant=1000, telephone="699001122", description="x",
                                            reference_externe=REF)
                for s in SECRETS + ("699001122",):
                    self.assertNotIn(s, str(cm.exception))
        self.assertNotIn("699001122", "\n".join(logs.output))
        for s in SECRETS:
            self.assertNotIn(s, "\n".join(logs.output))


class LienTests(Base):
    def lien(self, **kw):
        base = dict(montant=50000, description="Commande", reference_externe=REF,
                    url_retour="https://site.test/commandes/1/payer?paiement=2",
                    url_echec="https://site.test/commandes/1/payer?paiement=2")
        base.update(kw)
        return client.lien_paiement(**base)

    def test_lien(self):
        self.poster(rep(200, {"link": "https://campay.test/pay/abc"}))
        self.assertEqual(self.lien(), "https://campay.test/pay/abc")
        corps = self.appels("/get_payment_link/")[0].kwargs["json"]
        self.assertEqual(corps["amount"], "50000")
        self.assertEqual(corps["currency"], "XAF")
        self.assertEqual(corps["external_reference"], REF)
        self.assertIn("redirect_url", corps)

    def test_adresses_refusees(self):
        for url in ("http://site.test/x", "javascript:alert(1)", "ftp://site.test", "//site.test",
                    "https://", "", None, "https://site.test/ x", "http://localhost.evil.test/"):
            with self.assertRaises(CampayErreurDefinitive, msg=str(url)):
                self.lien(url_retour=url)
            with self.assertRaises(CampayErreurDefinitive, msg=str(url)):
                self.lien(url_echec=url)

    @override_settings(DEBUG=True)
    def test_localhost_accepte_en_developpement(self):
        self.poster(rep(200, {"link": "https://campay.test/pay/abc"}))
        self.lien(url_retour="http://localhost:5173/x", url_echec="http://localhost:5173/y")

    @override_settings(DEBUG=False)
    def test_localhost_refuse_en_production(self):
        with self.assertRaises(CampayErreurDefinitive):
            self.lien(url_retour="http://localhost:5173/x", url_echec="http://localhost:5173/y")

    def test_reponse_sans_lien_https(self):
        for corps in ({}, {"link": "http://pirate.test"}, {"link": "javascript:x"}):
            self.poster(rep(200, corps))
            with self.assertRaises(CampayErreurTemporaire):
                self.lien()

    def test_erreurs(self):
        self.poster(rep(400, {}))
        with self.assertRaises(CampayErreurDefinitive):
            self.lien()
        self.poster(rep(503))
        with self.assertRaises(CampayErreurTemporaire):
            self.lien()


class StatutTests(Base):
    def lire(self, corps, code=200):
        with mock.patch("integrations.campay.client.requests.post", return_value=jeton()), \
                mock.patch("integrations.campay.client.requests.get",
                           return_value=rep(code, corps)) as get:
            self.get = get
            return client.statut(UUID)

    def corps(self, **kw):
        base = {"reference": UUID, "status": "SUCCESSFUL", "amount": 15000, "currency": "XAF",
                "operator": "MTN", "operator_reference": "OP123", "external_reference": REF}
        base.update(kw)
        return base

    def test_reussi(self):
        t = self.lire(self.corps())
        self.assertEqual(t, Transaction(reference=UUID, statut="reussi", montant=15000, devise="XAF",
                                        operateur="MTN", reference_operateur="OP123",
                                        reference_externe=REF, raison=""))
        self.assertEqual(self.get.call_args.args[0], f"https://campay.test/api/transaction/{UUID}/")
        self.assertEqual(self.get.call_args.kwargs["headers"], {"Authorization": "Token JETON-TEST"})

    def test_correspondance_des_statuts(self):
        self.assertEqual(self.lire(self.corps(status="PENDING")).statut, "en_attente")
        self.assertEqual(self.lire(self.corps(status="FAILED", reason="REJECTED")).statut, "echoue")
        self.assertEqual(self.lire(self.corps(status="successful")).statut, "reussi")

    def test_statut_inconnu_jamais_reussi(self):
        for s in ("REFUNDED", "SUCCESS", "OK", "", None, "SUCCESSFUL!", 1, "TRUE", "PAID"):
            self.assertEqual(self.lire(self.corps(status=s)).statut, "en_attente", repr(s))
        corps = self.corps()
        del corps["status"]
        self.assertEqual(self.lire(corps).statut, "en_attente")

    def test_montant_en_texte_ou_decimal(self):
        self.assertEqual(self.lire(self.corps(amount="15000")).montant, 15000)
        self.assertEqual(self.lire(self.corps(amount="15000.0")).montant, 15000)
        self.assertIsInstance(self.lire(self.corps(amount=15000.0)).montant, int)

    def test_montant_illisible(self):
        for m in ("15000.5", "abc", "NaN", "-3", "Infinity"):
            with self.assertRaises(CampayErreurTemporaire, msg=m):
                self.lire(self.corps(amount=m))

    def test_reference_controlee(self):
        for ref in ("../../etc", "abc", "a" * 65, "x/y/z/12345", "", None, 12345678):
            with mock.patch("integrations.campay.client.requests.get") as get:
                with self.assertRaises(CampayErreurDefinitive, msg=str(ref)):
                    client.statut(ref)
                get.assert_not_called()

    def test_erreurs_http(self):
        with self.assertRaises(CampayErreurDefinitive) as cm:
            self.lire({}, 404)
        self.assertEqual(cm.exception.code, "inconnue")
        for code in (429, 500, 503):
            with self.assertRaises(CampayErreurTemporaire):
                self.lire({}, code)
        with self.assertRaises(CampayErreurDefinitive):
            self.lire({}, 403)

    def test_reponse_illisible(self):
        with mock.patch("integrations.campay.client.requests.post", return_value=jeton()), \
                mock.patch("integrations.campay.client.requests.get",
                           return_value=rep(200, illisible=True)):
            with self.assertRaises(CampayErreurTemporaire):
                client.statut(UUID)
        with self.assertRaises(CampayErreurTemporaire):
            self.lire([1, 2])

    def test_reseau(self):
        with mock.patch("integrations.campay.client.requests.post", return_value=jeton()), \
                mock.patch("integrations.campay.client.requests.get",
                           side_effect=requests.Timeout("JETON-TEST")):
            with self.assertRaises(CampayErreurTemporaire) as cm:
                client.statut(UUID)
        self.assertNotIn("JETON-TEST", str(cm.exception))
