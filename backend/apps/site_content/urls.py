from django.urls import path

from . import views

urlpatterns = [path("accueil/", views.accueil, name="contenu-accueil")]
