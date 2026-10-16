"""Routes du back-end CIR.

- `/api/<module>/` : API publique (site) ; `/api/admin/<module>/` : API de l'équipe (tableau de bord).
- L'administration Django est servie à une adresse cachée (DJANGO_ADMIN_URL).
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/", include("apps.noyau.urls")),
    path("api/comptes/", include("apps.comptes.urls")),
    path("api/admin/comptes/", include("apps.comptes.urls_admin")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
