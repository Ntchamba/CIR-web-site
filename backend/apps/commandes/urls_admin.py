from rest_framework.routers import SimpleRouter

from .views_admin import CommandeAdminViewSet

app_name = "commandes_admin"

routeur = SimpleRouter()
routeur.register("", CommandeAdminViewSet, basename="commandes")

urlpatterns = routeur.urls
