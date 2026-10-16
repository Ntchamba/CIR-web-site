"""Routes du back-end CIR.

- `/api/<module>/` : API publique (site) ; `/api/admin/<module>/` : API de l'équipe (tableau de bord).
- L'administration Django est servie à une adresse cachée (DJANGO_ADMIN_URL).
- `/media/` : fichiers envoyés (images WebP, vidéos), servis par Django si DJANGO_SERVIR_MEDIAS est vrai.
"""
import re

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from apps.noyau.medias import servir_media

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/", include("apps.noyau.urls")),
    path("api/comptes/", include("apps.comptes.urls")),
    path("api/admin/comptes/", include("apps.comptes.urls_admin")),
    path("api/catalogue/", include("apps.catalogue.urls")),
    path("api/admin/catalogue/", include("apps.catalogue.urls_admin")),
    path("api/vitrine/", include("apps.vitrine.urls")),
    path("api/admin/vitrine/", include("apps.vitrine.urls_admin")),
    path("api/actualites/", include("apps.actualites.urls")),
    path("api/admin/actualites/", include("apps.actualites.urls_admin")),
    path("api/contenus/", include("apps.contenus.urls")),
    path("api/admin/contenus/", include("apps.contenus.urls_admin")),
]

if settings.SERVIR_MEDIAS:
    prefixe = re.escape(settings.MEDIA_URL.lstrip("/"))
    urlpatterns += [re_path(rf"^{prefixe}(?P<path>.*)$", servir_media, name="media")]
