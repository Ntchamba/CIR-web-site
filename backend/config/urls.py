"""Routes du back-end CIR.

/api/...        API du site public (visiteurs et clients)
/api/admin/...  API du tableau de bord (équipe du CIR uniquement)
/ws/...         messagerie instantanée (WebSocket, voir config/asgi.py)
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

api_public = [
    path("", include("apps.core.urls")),
    path("comptes/", include("apps.accounts.urls")),
    path("catalogue/", include("apps.catalog.urls")),
    path("vitrine/", include("apps.showcase.urls")),
    path("nouveautes/", include("apps.news.urls")),
    path("contenus/", include("apps.site_content.urls")),
    path("selection/", include("apps.selection.urls")),
    path("commandes/", include("apps.orders.urls")),
    path("contact/", include("apps.contact.urls")),
    path("messagerie/", include("apps.messaging.urls")),
    path("paiements/", include("apps.payments.urls")),      # à venir
    path("appels/", include("apps.telephony.urls")),        # à venir
]

api_admin = [
    path("comptes/", include("apps.accounts.urls_admin")),
    path("catalogue/", include("apps.catalog.urls_admin")),
    path("vitrine/", include("apps.showcase.urls_admin")),
    path("nouveautes/", include("apps.news.urls_admin")),
    path("contenus/", include("apps.site_content.urls_admin")),
    path("commandes/", include("apps.orders.urls_admin")),
    path("contact/", include("apps.contact.urls_admin")),
    path("messagerie/", include("apps.messaging.urls_admin")),
    path("statistiques/", include("apps.dashboard.urls_admin")),
]

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/admin/", include(api_admin)),
    path("api/", include(api_public)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "CIR : administration technique"
admin.site.site_title = "CIR"
