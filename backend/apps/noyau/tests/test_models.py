"""Le noyau n'a pas de modèle : on vérifie ici la configuration commune (réglages dev et prod)."""
import os
import subprocess
import sys
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.test import SimpleTestCase

BACKEND = Path(settings.BASE_DIR)


def charger_prod(**env):
    """Importe config.settings.prod dans un sous-processus avec l'environnement donné."""
    environnement = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "DATABASE_URL"))}
    environnement.update(env)
    code = "import config.settings.prod as p; print(p.DEBUG, p.DATABASES['default']['ENGINE'], p.SECURE_SSL_REDIRECT)"
    return subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=environnement,
                          capture_output=True, text=True)


class NoyauSansModeleTests(SimpleTestCase):
    def test_aucun_modele(self):
        self.assertEqual(list(apps.get_app_config("noyau").get_models()), [])

    def test_utilisateur_personnalise(self):
        self.assertEqual(settings.AUTH_USER_MODEL, "comptes.Utilisateur")

    def test_langue_et_fuseau(self):
        self.assertEqual(settings.LANGUAGE_CODE, "fr-fr")
        self.assertEqual(settings.TIME_ZONE, "Africa/Douala")

    def test_blocage_connexion_configure(self):
        self.assertEqual(settings.CONNEXION_ESSAIS_MAX, 5)
        self.assertEqual(settings.CONNEXION_BLOCAGE_SECONDES, 15 * 60)

    def test_liste_noire_jwt_active(self):
        self.assertIn("rest_framework_simplejwt.token_blacklist", settings.INSTALLED_APPS)
        self.assertTrue(settings.SIMPLE_JWT["BLACKLIST_AFTER_ROTATION"])


class ReglagesProductionTests(SimpleTestCase):
    CLE = "k" * 60

    def test_refuse_la_cle_de_developpement(self):
        r = charger_prod(DATABASE_URL="postgres://u:p@h:5432/b")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", r.stderr)

    def test_refuse_une_cle_trop_courte(self):
        r = charger_prod(DJANGO_SECRET_KEY="courte", DATABASE_URL="postgres://u:p@h:5432/b")
        self.assertNotEqual(r.returncode, 0)

    def test_exige_database_url(self):
        r = charger_prod(DJANGO_SECRET_KEY=self.CLE)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("DATABASE_URL", r.stderr)

    def test_postgres_https_et_debug_coupe(self):
        r = charger_prod(DJANGO_SECRET_KEY=self.CLE, DATABASE_URL="postgres://u:p@h:5432/b", DJANGO_DEBUG="1")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.split(), ["False", "django.db.backends.postgresql", "True"])
