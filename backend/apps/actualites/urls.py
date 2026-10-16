from rest_framework.routers import SimpleRouter

from .views import ActualiteViewSet

app_name = "actualites"

routeur = SimpleRouter()
routeur.register("", ActualiteViewSet, basename="actualites")

urlpatterns = routeur.urls
