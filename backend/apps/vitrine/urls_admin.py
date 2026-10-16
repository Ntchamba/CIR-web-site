from rest_framework.routers import SimpleRouter

from .views_admin import DemoAdminViewSet, RealisationAdminViewSet, TemoignageAdminViewSet

app_name = "vitrine_admin"

routeur = SimpleRouter()
routeur.register("realisations", RealisationAdminViewSet, basename="realisations")
routeur.register("demos", DemoAdminViewSet, basename="demos")
routeur.register("temoignages", TemoignageAdminViewSet, basename="temoignages")

urlpatterns = routeur.urls
