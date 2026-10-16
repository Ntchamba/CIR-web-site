from django.urls import path

from .views import AccueilView

app_name = "contenus"

urlpatterns = [
    path("accueil/", AccueilView.as_view(), name="accueil"),
]
