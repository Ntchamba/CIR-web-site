from rest_framework.routers import SimpleRouter

from .views_admin import DesignAdminViewSet, FamilleAdminViewSet, ImageProduitAdminViewSet, ProduitAdminViewSet

app_name = "catalogue_admin"

routeur = SimpleRouter()
routeur.register("familles", FamilleAdminViewSet, basename="familles")
routeur.register("produits", ProduitAdminViewSet, basename="produits")
routeur.register("images", ImageProduitAdminViewSet, basename="images")
routeur.register("designs", DesignAdminViewSet, basename="designs")

urlpatterns = routeur.urls
