"""Tests des webhooks CamPay : signature et lecture tolérante."""
import json
from unittest import TestCase, mock

import jwt

from integrations.campay import webhooks
from integrations.campay.webhooks import EvenementCampay

CLE = "cle-webhook-test-0123456789-0123456789-0123456789-0123456789-abcdef0123456789"


def signature(cle=CLE, **extra):
    return jwt.encode({"x": 1, **extra}, cle, algorithm="HS256")


class SignatureTests(TestCase):
    def setUp(self):
        p = mock.patch.dict("os.environ", {"CAMPAY_WEBHOOK_KEY": CLE}, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def test_valide(self):
        self.assertTrue(webhooks.verifier_signature({"signature": signature()}))

    def test_valide_en_json_et_en_octets(self):
        corps = json.dumps({"signature": signature()})
        self.assertTrue(webhooks.verifier_signature(corps))
        self.assertTrue(webhooks.verifier_signature(corps.encode()))

    def test_invalide(self):
        faux = signature(cle="autre-cle-autre-cle-autre-cle-autre-cle-autre-cle-autre-cle-autre-cle")
        for p in ({"signature": faux}, {"signature": "n'importe quoi"}, {"signature": signature() + "x"}):
            self.assertFalse(webhooks.verifier_signature(p))

    def test_absente_ou_mal_formee(self):
        for p in ({}, {"signature": ""}, {"signature": None}, {"signature": 12}, None, "pas du json",
                  b"\xff\xfe", [], {"reference": "abc"}):
            self.assertFalse(webhooks.verifier_signature(p))

    def test_expiree(self):
        self.assertFalse(webhooks.verifier_signature({"signature": signature(exp=1)}))

    def test_algorithme_none_refuse(self):
        sans = jwt.encode({"x": 1}, None, algorithm="none")
        self.assertFalse(webhooks.verifier_signature({"signature": sans}))

    def test_autre_algorithme_refuse(self):
        self.assertFalse(webhooks.verifier_signature(
            {"signature": jwt.encode({"x": 1}, CLE, algorithm="HS512")}))

    def test_cle_non_configuree(self):
        s = signature()
        for env in ({}, {"CAMPAY_WEBHOOK_KEY": ""}, {"CAMPAY_WEBHOOK_KEY": "  "}):
            with mock.patch.dict("os.environ", env, clear=True):
                self.assertFalse(webhooks.verifier_signature({"signature": s}))


class AnalyseTests(TestCase):
    def test_parametres(self):
        e = webhooks.analyser({"reference": "abc-123", "external_reference": "cir-xyz",
                               "status": "successful", "amount": "100"})
        self.assertEqual(e, EvenementCampay("abc-123", "cir-xyz", "SUCCESSFUL"))

    def test_json(self):
        e = webhooks.analyser(json.dumps({"external_reference": "cir-xyz", "status": "FAILED"}))
        self.assertEqual(e, EvenementCampay("", "cir-xyz", "FAILED"))
        self.assertEqual(webhooks.analyser(b'{"reference": "r1234567"}').reference, "r1234567")

    def test_querydict(self):
        from django.http import QueryDict
        e = webhooks.analyser(QueryDict("reference=abc&status=PENDING"))
        self.assertEqual(e, EvenementCampay("abc", "", "PENDING"))

    def test_invalide(self):
        for p in (None, "", "pas json", b"\xff", [], 12, {}, {"status": "SUCCESSFUL"},
                  {"reference": ["a"], "external_reference": {"a": 1}}, {"reference": "x" * 129},
                  {"reference": "a\nb"}, {"reference": True}, "[1, 2]"):
            self.assertIsNone(webhooks.analyser(p), repr(p))
