from rest_framework.routers import SimpleRouter

from .views_admin import ActualiteAdminViewSet

app_name = "actualites_admin"

routeur = SimpleRouter()
routeur.register("", ActualiteAdminViewSet, basename="actualites")

urlpatterns = routeur.urls
