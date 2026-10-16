"""Réglages de production (Railway) : PostgreSQL via DATABASE_URL, HTTPS obligatoire (BNF-06, BNF-08)."""
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import SECRET_KEY, env, env_bool, env_liste

DEBUG = False

if SECRET_KEY.startswith("dev-") or len(SECRET_KEY) < 50:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY doit être une clé secrète d'au moins 50 caractères en production.")

if not env("DATABASE_URL"):
    raise ImproperlyConfigured("La production utilise PostgreSQL : renseigner DATABASE_URL.")
DATABASES = {"default": dj_database_url.parse(env("DATABASE_URL"), conn_max_age=60, conn_health_checks=True)}

# Origines autorisées : site public et tableau de bord (admin.revelation-sarl.com). Remplaçables par
# les variables CORS_ALLOWED_ORIGINS et DJANGO_CSRF_TRUSTED_ORIGINS.
ORIGINES_CIR = "https://revelation-sarl.com,https://www.revelation-sarl.com,https://admin.revelation-sarl.com"
CORS_ALLOWED_ORIGINS = env_liste("CORS_ALLOWED_ORIGINS", ORIGINES_CIR)
CSRF_TRUSTED_ORIGINS = env_liste("DJANGO_CSRF_TRUSTED_ORIGINS", ORIGINES_CIR + ",https://api.revelation-sarl.com")

# Railway termine le TLS devant l'application et transmet X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
# La sonde de santé de Railway appelle /api/sante/ en HTTP interne : pas de redirection.
SECURE_REDIRECT_EXEMPT = [r"^api/sante/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(env("DJANGO_HSTS_SECONDES", str(60 * 60 * 24 * 365)))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = env_bool("DJANGO_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

# Railway place un proxy devant l'application : 1 proxy de confiance par défaut.
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": int(env("DJANGO_NOMBRE_PROXIES", "1"))}  # noqa: F405

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
