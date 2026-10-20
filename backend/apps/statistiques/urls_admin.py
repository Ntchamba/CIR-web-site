from django.urls import path

from . import views_admin as v

app_name = "statistiques_admin"

urlpatterns = [
    path("resume/", v.ResumeView.as_view(), name="resume"),
    path("evolution/", v.EvolutionView.as_view(), name="evolution"),
]
