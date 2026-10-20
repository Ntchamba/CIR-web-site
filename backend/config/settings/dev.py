"""Réglages de développement : SQLite, DEBUG actif, tous les hôtes acceptés."""
from .base import *  # noqa: F401,F403
from .base import BASE_DIR, env, env_bool

DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": env("SQLITE_PATH", str(BASE_DIR / "db.sqlite3")),
    }
}

# WhiteNoise sert aussi les fichiers des applications en développement (sans collectstatic).
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = True
(BASE_DIR / "staticfiles").mkdir(exist_ok=True)

# En développement, les e-mails sont envoyés (ou écrits dans la console) juste après chaque action.
NOTIFICATIONS_ENVOI_IMMEDIAT = env_bool("NOTIFICATIONS_ENVOI_IMMEDIAT", True)
