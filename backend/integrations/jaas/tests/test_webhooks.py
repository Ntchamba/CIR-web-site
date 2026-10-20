"""Tests des webhooks JaaS."""
import json
from unittest import TestCase, mock

from integrations.jaas import webhooks


class VerifierTests(TestCase):
    def test_secret_non_configure(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertFalse(webhooks.verifier({"X-Webhook-Secret": ""}, b""))
            self.assertFalse(webhooks.verifier({"X-Webhook-Secret": "x"}, b""))

    def test_secret(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret-test"}, clear=True):
            self.assertTrue(webhooks.verifier({"X-Webhook-Secret": "s3cret-test"}, b""))
            self.assertTrue(webhooks.verifier({"x-webhook-secret": "s3cret-test"}, b""))
            self.assertTrue(webhooks.verifier({"HTTP_X_WEBHOOK_SECRET": "s3cret-test"}, b""))
            self.assertTrue(webhooks.verifier({"Authorization": "Bearer s3cret-test"}, b""))
            self.assertFalse(webhooks.verifier({"X-Webhook-Secret": "faux"}, b""))
            self.assertFalse(webhooks.verifier({"Authorization": "Bearer faux"}, b""))
            self.assertFalse(webhooks.verifier({"Authorization": "s3cret-test"}, b""))
            self.assertFalse(webhooks.verifier({}, b""))
            self.assertFalse(webhooks.verifier(None, b""))

    def test_comparaison_temps_constant(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "abc"}, clear=True), \
                mock.patch("integrations.jaas.webhooks.hmac.compare_digest", return_value=True) as cd:
            self.assertTrue(webhooks.verifier({"X-Webhook-Secret": "abc"}, b""))
            cd.assert_called_once()

    def test_secret_non_ascii(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "abc"}, clear=True):
            self.assertFalse(webhooks.verifier({"X-Webhook-Secret": "abç"}, b""))


class AnalyserTests(TestCase):
    def test_evenements(self):
        corps = json.dumps({"eventType": "PARTICIPANT_JOINED", "timestamp": 1700000000000,
                            "fqn": "app123/salle-abcdefgh",
                            "data": {"participantId": "p1"}})
        ev = webhooks.analyser(corps.encode())
        self.assertEqual(len(ev), 1)
        self.assertEqual((ev[0].type, ev[0].salle, ev[0].participant_id, ev[0].horodatage),
                         ("PARTICIPANT_JOINED", "salle-abcdefgh", "p1", 1700000000000))

    def test_liste_et_inconnus(self):
        corps = json.dumps([
            {"eventType": "ROOM_CREATED", "fqn": "a/salle-12345678"},
            {"eventType": "RECORDING_STARTED", "fqn": "a/salle-12345678"},
            {"eventType": "ROOM_DESTROYED", "fqn": "a/salle-12345678"},
            "bizarre", 3, None,
        ])
        self.assertEqual([e.type for e in webhooks.analyser(corps)], ["ROOM_CREATED", "ROOM_DESTROYED"])

    def test_corps_invalide(self):
        for corps in [b"pas du json", b"\xff\xfe", "", b"", None, "null", "42"]:
            with self.subTest(corps=corps):
                self.assertEqual(webhooks.analyser(corps), [])

    def test_type_inconnu_ignore(self):
        self.assertEqual(webhooks.analyser('{"eventType": "AUTRE"}'), [])


class SecuriteSupplementaireTests(TestCase):
    def test_prefixe_ou_suffixe_du_secret_refuse(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret-test"}, clear=True):
            for faux in ["s3cret", "s3cret-test2", "xs3cret-test", "S3CRET-TEST"]:
                with self.subTest(faux=faux):
                    self.assertFalse(webhooks.verifier({"X-Webhook-Secret": faux}, b""))
                    self.assertFalse(webhooks.verifier({"Authorization": f"Bearer {faux}"}, b""))

    def test_bearer_insensible_a_la_casse_du_schema(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret-test"}, clear=True):
            self.assertTrue(webhooks.verifier({"Authorization": "bearer s3cret-test"}, b""))

    def test_secret_vide_recu_refuse(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret-test"}, clear=True):
            self.assertFalse(webhooks.verifier({"X-Webhook-Secret": "  "}, b""))
            self.assertFalse(webhooks.verifier({"Authorization": "Bearer "}, b""))

    def test_secret_configure_vide_ne_laisse_rien_passer(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": ""}, clear=True):
            self.assertFalse(webhooks.verifier({"X-Webhook-Secret": ""}, b""))
            self.assertFalse(webhooks.verifier({"Authorization": "Bearer "}, b""))

    def test_analyse_variantes_de_format(self):
        corps = json.dumps({"eventType": "PARTICIPANT_LEFT",
                            "data": {"fqn": "app/salle-abcdefgh", "participant": {"id": "p9"}}})
        ev = webhooks.analyser(corps)
        self.assertEqual((ev[0].salle, ev[0].participant_id), ("salle-abcdefgh", "p9"))

    def test_analyse_donnees_mal_formees(self):
        for corps in ['{"eventType": "ROOM_CREATED", "data": "x"}', '{"eventType": ["ROOM_CREATED"]}']:
            with self.subTest(corps=corps):
                try:
                    webhooks.analyser(corps)
                except Exception as exc:  # pragma: no cover
                    self.fail(f"ne doit jamais lever : {exc!r}")
