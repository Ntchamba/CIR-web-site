from rest_framework.routers import SimpleRouter

from .views_admin import DemandeRenduAdminViewSet, DevisAdminViewSet

app_name = "devis_admin"

routeur = SimpleRouter()
routeur.register("demandes-rendu", DemandeRenduAdminViewSet, basename="demandes-rendu")
routeur.register("", DevisAdminViewSet, basename="devis")

urlpatterns = routeur.urls
