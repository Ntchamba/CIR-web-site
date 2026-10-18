from rest_framework.routers import SimpleRouter

from .views import DemandeContactViewSet

app_name = "contact"

routeur = SimpleRouter()
routeur.register("demandes", DemandeContactViewSet, basename="demandes")

urlpatterns = routeur.urls
