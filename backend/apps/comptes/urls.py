from django.urls import path

from .views import ConnexionView, DeconnexionView, InscriptionView, MoiView, RafraichissementView

app_name = "comptes"

urlpatterns = [
    path("inscription/", InscriptionView.as_view(), name="inscription"),
    path("connexion/", ConnexionView.as_view(), name="connexion"),
    path("connexion/rafraichir/", RafraichissementView.as_view(), name="rafraichir"),
    path("deconnexion/", DeconnexionView.as_view(), name="deconnexion"),
    path("moi/", MoiView.as_view(), name="moi"),
]
