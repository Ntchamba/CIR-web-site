from django.urls import path
from rest_framework.routers import SimpleRouter

from .views_admin import ClientsViewSet, ConnexionEquipeView, EquipeViewSet

app_name = "comptes_admin"

routeur = SimpleRouter()
routeur.register("equipe", EquipeViewSet, basename="equipe")
routeur.register("clients", ClientsViewSet, basename="clients")

urlpatterns = [
    path("connexion/", ConnexionEquipeView.as_view(), name="connexion"),
    *routeur.urls,
]
