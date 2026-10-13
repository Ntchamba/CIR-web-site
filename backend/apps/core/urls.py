from django.urls import path

from . import views

urlpatterns = [
    path("sante/", views.sante, name="sante"),
    path("coordonnees/", views.coordonnees, name="coordonnees"),
]
