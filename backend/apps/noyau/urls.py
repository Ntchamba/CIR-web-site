from django.urls import path

from .sante import sante

app_name = "noyau"

urlpatterns = [
    path("sante/", sante, name="sante"),
]
