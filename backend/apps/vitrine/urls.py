from rest_framework.routers import SimpleRouter

from .views import DemoViewSet, RealisationViewSet, TemoignageViewSet

app_name = "vitrine"

routeur = SimpleRouter()
routeur.register("realisations", RealisationViewSet, basename="realisations")
routeur.register("demos", DemoViewSet, basename="demos")
routeur.register("temoignages", TemoignageViewSet, basename="temoignages")

urlpatterns = routeur.urls
