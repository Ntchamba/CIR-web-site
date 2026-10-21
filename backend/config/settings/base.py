"""Réglages communs du back-end CIR (développement et production).

Toutes les valeurs sensibles ou propres à un environnement viennent des variables d'environnement,
lues depuis `backend/.env` en local (python-dotenv). Voir `backend/.env.example`.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def env(nom, defaut=""):
    return os.environ.get(nom, defaut)


def env_bool(nom, defaut=False):
    valeur = os.environ.get(nom)
    if valeur is None:
        return defaut
    return valeur.strip().lower() in ("1", "true", "vrai", "oui", "yes")


def env_liste(nom, defaut=""):
    return [v.strip() for v in os.environ.get(nom, defaut).split(",") if v.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-seulement-cle-non-secrete-a-remplacer")
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_liste("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = env_liste("DJANGO_CSRF_TRUSTED_ORIGINS")
# Adresse cachée de l'administration Django (porte technique, distincte du tableau de bord)
ADMIN_URL = env("DJANGO_ADMIN_URL", "gestion-interne/")

INSTALLED_APPS = [
    "daphne",  # doit précéder staticfiles : runserver devient ASGI (WebSocket)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Bibliothèques
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    # Modules CIR (docs/architecture.md)
    "apps.noyau",
    "apps.comptes",  # BF-08, BF-17
    "apps.catalogue",  # BF-01, BF-05, BF-06, BF-14
    "apps.vitrine",  # BF-02, BF-03, BF-04, BF-15
    "apps.actualites",  # BF-07
    "apps.contenus",  # BF-15, O2
    "apps.selection",  # BF-09
    "apps.commandes",  # BF-10, BF-12, BF-13, BF-16
    "apps.devis",  # BF-11, BF-12
    "apps.contact",  # BF-11, BF-13
    "apps.messagerie",  # BF-11 (vague 3)
    "apps.appels",  # BF-11 (vague 3)
    "apps.notifications",  # BF-07, BF-13 (vague 3)
    "apps.paiements",  # BF-10, BF-12 (vague 4)
    "apps.statistiques",  # BF-16 (vague 4)
    "apps.assistant",  # O1, O4 (vague 5)
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Langue de chaque réponse d'après l'en-tête Accept-Language envoyé par le site et le tableau de bord
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Base de données : définie dans dev.py (SQLite) et prod.py (PostgreSQL via DATABASE_URL).
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_USER_MODEL = "comptes.Utilisateur"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Multilingue (fiche de décision 7) : français (référence), anglais, chinois simplifié, allemand, japonais.
# Les messages de l'API sont traduits dans backend/locale/ (python manage.py compiler_traductions).
LANGUAGE_CODE = "fr"
LANGUAGES = [
    ("fr", "Français"),
    ("en", "English"),
    ("zh-hans", "中文"),
    ("de", "Deutsch"),
    ("ja", "日本語"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "Africa/Douala"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))
# Service des fichiers /media/ par Django (production : volume Railway monté sur DJANGO_MEDIA_ROOT),
# avec un en-tête de cache (apps/noyau/medias.py). Vrai par défaut ; 0 si un autre service s'en charge.
SERVIR_MEDIAS = env_bool("DJANGO_SERVIR_MEDIAS", True)
# Pièces jointes de la messagerie : dossier PRIVÉ (jamais servi par /media/), lu par une vue qui vérifie les droits.
# Production : chemin d'un volume Railway, ex. /data/prive
PRIVATE_ROOT = Path(env("DJANGO_PRIVATE_ROOT", str(BASE_DIR / "prive")))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Taille maximale d'un envoi hors fichiers (les fichiers au-delà de 5 Mo passent par un fichier temporaire ;
# leurs plafonds sont contrôlés par apps/noyau/images.py et apps/noyau/medias.py : images 10 Mo, vidéos 50 Mo)
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# --- API ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.noyau.pagination.PaginationStandard",
    "PAGE_SIZE": 24,
    # contact : 5 demandes par heure et par adresse IP (les autres quotas, par compte et par jour, sont dans les services)
    "DEFAULT_THROTTLE_RATES": {"inscription": "20/hour", "contact": "5/hour"},
    # Nombre de proxys de confiance devant l'application : l'adresse du client est la valeur ajoutée
    # par le dernier proxy dans X-Forwarded-For. 0 = REMOTE_ADDR (en-tête ignoré, valeur de dev/tests).
    "NUM_PROXIES": int(env("DJANGO_NOMBRE_PROXIES", "0") or "0"),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(env("JWT_ACCES_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(env("JWT_RAFRAICHISSEMENT_JOURS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Connexion : blocage après 5 essais incorrects pendant 15 minutes (BNF-01)
CONNEXION_ESSAIS_MAX = 5
CONNEXION_BLOCAGE_SECONDES = 15 * 60
# Second compteur par adresse IP (plusieurs comptes essayés depuis la même adresse)
CONNEXION_ESSAIS_MAX_IP = 20

CORS_ALLOWED_ORIGINS = env_liste("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174")

# --- Cache et canaux (Channels) : Redis si REDIS_URL est fourni, sinon mémoire du processus ---
REDIS_URL = env("REDIS_URL")
if REDIS_URL:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL}}
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": {"hosts": [REDIS_URL]}}
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# --- E-mails ---
# Les e-mails des notifications passent par la file d'envoi (apps/notifications) et l'API Gmail
# (backend/integrations/gmail) ; EMAIL_BACKEND ne sert qu'aux messages techniques de Django.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "CIR <no-reply@revelation-sarl.com>")

# --- Échanges en direct, appels et notifications (vague 3) ---
# Adresses publiques utilisées dans les liens des e-mails (sans « / » final)
SITE_URL = env("SITE_URL").rstrip("/")
ADMIN_URL_PUBLIQUE = env("ADMIN_URL_PUBLIQUE").rstrip("/")
API_URL_PUBLIQUE = env("API_URL_PUBLIQUE").rstrip("/")  # lien de désabonnement (API)
# 1 : l'envoi est tenté juste après la transaction ; 0 : seulement par `manage.py envoyer_emails`
NOTIFICATIONS_ENVOI_IMMEDIAT = env_bool("NOTIFICATIONS_ENVOI_IMMEDIAT", False)
GMAIL_LIMITE_JOUR = int(env("GMAIL_LIMITE_JOUR", "400") or "400")
# Offre gratuite JaaS : 25 utilisateurs actifs par mois
JAAS_LIMITE_GRATUITE = int(env("JAAS_LIMITE_GRATUITE", "25") or "25")

# --- Paiements CamPay (vague 4) ---
# Les clés (CAMPAY_USERNAME, CAMPAY_PASSWORD, CAMPAY_BASE_URL, CAMPAY_WEBHOOK_KEY) sont lues par integrations/campay.
PAIEMENT_MONTANT_MINIMUM = int(env("PAIEMENT_MONTANT_MINIMUM", "100") or "100")
PAIEMENT_EXPIRATION_MINUTES = int(env("PAIEMENT_EXPIRATION_MINUTES", "15") or "15")

# --- Assistant IA (vague 5) ---
# La clé GEMINI_API_KEY est lue par integrations/gemini ; jamais écrite dans le code ni dans les journaux.
GEMINI_MODELE_ASSISTANT = env("GEMINI_MODELE_ASSISTANT", "gemini-2.5-flash") or "gemini-2.5-flash"
GEMINI_MODELE_FOND = env("GEMINI_MODELE_FOND", "gemini-2.5-flash") or "gemini-2.5-flash"
# Nombre maximal de messages d'assistant par jour pour tout le site (protège le budget)
ASSISTANT_LIMITE_JOUR = int(env("ASSISTANT_LIMITE_JOUR", "1000") or "1000")
# Conservation des conversations (jours)
ASSISTANT_RETENTION_JOURS = int(env("ASSISTANT_RETENTION_JOURS", "90") or "90")
# Dossier des prompts, connaissances et évaluations (backend/agents/, dans la racine du service Railway)
ASSISTANT_AGENTS_DIR = Path(env("ASSISTANT_AGENTS_DIR") or BASE_DIR / "agents")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"cir": {"handlers": ["console"], "level": env("CIR_LOG_LEVEL", "INFO")}},
}
