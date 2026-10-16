from django.urls import path
from rest_framework.routers import SimpleRouter

from .views_admin import AccueilAdminView, BandeauAdminViewSet, PhotoSphereAdminViewSet

app_name = "contenus_admin"

routeur = SimpleRouter()
routeur.register("bandeaux", BandeauAdminViewSet, basename="bandeaux")
routeur.register("sphere", PhotoSphereAdminViewSet, basename="sphere")

urlpatterns = [
    path("accueil/", AccueilAdminView.as_view(), name="accueil"),
    *routeur.urls,
]
