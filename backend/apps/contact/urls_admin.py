from rest_framework.routers import SimpleRouter

from .views_admin import DemandeContactAdminViewSet

app_name = "contact_admin"

routeur = SimpleRouter()
routeur.register("demandes", DemandeContactAdminViewSet, basename="demandes")

urlpatterns = routeur.urls
