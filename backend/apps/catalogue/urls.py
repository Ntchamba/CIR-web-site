from rest_framework.routers import SimpleRouter

from .views import FamilleViewSet, ProduitViewSet

app_name = "catalogue"

routeur = SimpleRouter()
routeur.register("familles", FamilleViewSet, basename="familles")
routeur.register("produits", ProduitViewSet, basename="produits")

urlpatterns = routeur.urls
