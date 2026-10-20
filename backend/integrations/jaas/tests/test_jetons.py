"""Tests des jetons JaaS : clé RSA générée ici, jamais stockée."""
import time
from unittest import TestCase, mock

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from integrations.jaas import jetons
from integrations.jaas.erreurs import JaasNonConfigure, JaasSalleInvalide


def _generer():
    cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = cle.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption()).decode()
    pub = cle.public_key().public_bytes(serialization.Encoding.PEM,
                                        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return pem, pub


PEM, PUB = _generer()
ENV = {"JAAS_APP_ID": "vpaas-magic-cookie-test", "JAAS_KEY_ID": "vpaas-magic-cookie-test/cle1",
       "JAAS_PRIVATE_KEY": PEM}


def _decoder(jeton):
    return jwt.decode(jeton, PUB, algorithms=["RS256"], audience="jitsi")


class JetonsTests(TestCase):
    def setUp(self):
        p = mock.patch.dict("os.environ", ENV, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def test_configure(self):
        self.assertTrue(jetons.configure())

    def test_parametres_client(self):
        self.assertEqual(jetons.parametres_client(),
                         {"domaine": "8x8.vc", "app_id": ENV["JAAS_APP_ID"]})

    def test_claims_et_entete(self):
        jeton = jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=7, nom="Aïcha Éka 张伟")
        entete = jwt.get_unverified_header(jeton)
        self.assertEqual(entete["alg"], "RS256")
        self.assertEqual(entete["kid"], ENV["JAAS_KEY_ID"])
        c = _decoder(jeton)
        self.assertEqual((c["aud"], c["iss"], c["sub"], c["room"]),
                         ("jitsi", "chat", ENV["JAAS_APP_ID"], "salle-abcdefgh"))
        self.assertEqual(c["context"]["user"],
                         {"id": "7", "name": "Aïcha Éka 张伟", "email": "", "moderator": "false"})
        self.assertEqual(set(c["context"]["features"].values()), {"false"})
        self.assertEqual(set(c["context"]["features"]),
                         {"recording", "livestreaming", "transcription", "outbound-call"})

    def test_duree_et_nbf(self):
        avant = int(time.time())
        c = _decoder(jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A"))
        self.assertAlmostEqual(c["exp"] - avant, 7200, delta=3)
        self.assertAlmostEqual(avant - c["nbf"], 10, delta=3)
        c = _decoder(jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A",
                                        duree_secondes=60))
        self.assertAlmostEqual(c["exp"] - avant, 60, delta=3)

    def test_moderateur(self):
        c = _decoder(jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="Eq",
                                        email="eq@example.org", moderateur=True))
        self.assertEqual(c["context"]["user"]["moderator"], "true")
        self.assertEqual(c["context"]["user"]["email"], "eq@example.org")

    def test_mauvaise_cle_refusee(self):
        jeton = jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A")
        _, autre_pub = _generer()
        with self.assertRaises(jwt.InvalidSignatureError):
            jwt.decode(jeton, autre_pub, algorithms=["RS256"], audience="jitsi")

    def test_salles_invalides(self):
        for salle in ["court", "a" * 65, "salle avec espace", "salle/../x1", "salle\nabcdef", "é" * 10, "", None]:
            with self.subTest(salle=salle), self.assertRaises(JaasSalleInvalide):
                jetons.creer_jeton(salle=salle, utilisateur_id=1, nom="A")

    def test_cle_avec_retours_ligne_echappes(self):
        with mock.patch.dict("os.environ", {"JAAS_PRIVATE_KEY": PEM.replace("\n", "\\n")}):
            self.assertTrue(jetons.configure())
            _decoder(jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A"))

    def test_variables_absentes(self):
        for var in ENV:
            env = {k: v for k, v in ENV.items() if k != var}
            with mock.patch.dict("os.environ", env, clear=True):
                self.assertFalse(jetons.configure())
                with self.assertRaises(JaasNonConfigure):
                    jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A")

    def test_cle_illisible_sans_fuite(self):
        secret = "PAS-UNE-CLE-SECRETE-123"
        with mock.patch.dict("os.environ", {"JAAS_PRIVATE_KEY": secret}):
            self.assertFalse(jetons.configure())
            with self.assertRaises(JaasNonConfigure) as ctx:
                jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A")
            self.assertNotIn(secret, str(ctx.exception))


class DurcissementTests(TestCase):
    """Cas limites ajoutés par le testeur."""

    def setUp(self):
        p = mock.patch.dict("os.environ", ENV, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def test_salle_avec_retour_ligne_final_refusee(self):
        # `$` accepte un « \n » final avec `match` : le nom doit être contrôlé en entier.
        for salle in ["salle-abcdefgh\n", "salle-abcdefgh\r\n", "salle-abcdefgh "]:
            with self.subTest(salle=salle), self.assertRaises(JaasSalleInvalide):
                jetons.creer_jeton(salle=salle, utilisateur_id=1, nom="A")

    def test_salles_limites_acceptees(self):
        for salle in ["a" * 8, "a" * 64, "Ab_cd-12"]:
            c = _decoder(jetons.creer_jeton(salle=salle, utilisateur_id=1, nom="A"))
            self.assertEqual(c["room"], salle)

    def test_cle_non_rsa_refusee_proprement(self):
        from cryptography.hazmat.primitives.asymmetric import ec
        cle = ec.generate_private_key(ec.SECP256R1())
        pem = cle.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption()).decode()
        with mock.patch.dict("os.environ", {"JAAS_PRIVATE_KEY": pem}):
            self.assertFalse(jetons.configure())
            with self.assertRaises(JaasNonConfigure):
                jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A")

    def test_cle_chiffree_refusee(self):
        cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem = cle.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.BestAvailableEncryption(b"mdp")).decode()
        with mock.patch.dict("os.environ", {"JAAS_PRIVATE_KEY": pem}):
            self.assertFalse(jetons.configure())

    def test_jeton_expire_refuse(self):
        jeton = jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A", duree_secondes=-100)
        with self.assertRaises(jwt.ExpiredSignatureError):
            _decoder(jeton)

    def test_mauvaise_audience_refusee(self):
        jeton = jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A")
        with self.assertRaises(jwt.InvalidAudienceError):
            jwt.decode(jeton, PUB, algorithms=["RS256"], audience="autre")

    def test_aucune_cle_privee_dans_le_jeton(self):
        jeton = jetons.creer_jeton(salle="salle-abcdefgh", utilisateur_id=1, nom="A")
        self.assertNotIn("PRIVATE KEY", jeton)

    def test_parametres_client_sans_app_id(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertEqual(jetons.parametres_client()["app_id"], "")
