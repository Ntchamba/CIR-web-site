"""Réglages de production : HTTPS obligatoire, PostgreSQL, Redis (BNF-06, BNF-08)."""
import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import DATABASES, SECRET_KEY

DEBUG = False

if SECRET_KEY.startswith("dev-") or len(SECRET_KEY) < 40:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY doit être une longue clé secrète en production.")
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured("La production utilise PostgreSQL : renseigner POSTGRES_DB.")
if not os.environ.get("REDIS_URL"):
    raise ImproperlyConfigured("La messagerie instantanée a besoin de REDIS_URL en production.")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": os.environ["REDIS_URL"]}
}
