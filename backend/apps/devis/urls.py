from rest_framework.routers import SimpleRouter

from .views import DemandeRenduViewSet, DevisViewSet

app_name = "devis"

routeur = SimpleRouter()
# « demandes-rendu » avant le préfixe vide : sinon « demandes-rendu/ » serait lu comme l'identifiant d'un devis
routeur.register("demandes-rendu", DemandeRenduViewSet, basename="demandes-rendu")
routeur.register("", DevisViewSet, basename="devis")

urlpatterns = routeur.urls
