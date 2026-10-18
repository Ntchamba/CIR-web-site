from rest_framework.routers import SimpleRouter

from .views import CommandeViewSet

app_name = "commandes"

routeur = SimpleRouter()
routeur.register("", CommandeViewSet, basename="commandes")

urlpatterns = routeur.urls
