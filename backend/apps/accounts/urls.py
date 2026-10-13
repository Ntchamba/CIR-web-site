from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from . import views

urlpatterns = [
    path("inscription/", views.InscriptionView.as_view(), name="inscription"),
    path("connexion/", views.ConnexionView.as_view(), name="connexion"),
    path("jeton/rafraichir/", TokenRefreshView.as_view(), name="jeton-rafraichir"),
    path("deconnexion/", TokenBlacklistView.as_view(), name="deconnexion"),
    path("moi/", views.MoiView.as_view(), name="moi"),
]
