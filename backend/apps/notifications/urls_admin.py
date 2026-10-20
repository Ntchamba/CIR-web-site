from django.urls import path

from . import views_admin as v

app_name = "notifications_admin"

urlpatterns = [
    path("", v.ListeEquipeView.as_view(), name="liste"),
    path("non-lues/", v.NonLuesEquipeView.as_view(), name="non-lues"),
    path("lues/", v.MarquerToutesLuesEquipeView.as_view(), name="lues"),
    path("preferences/", v.PreferencesEquipeView.as_view(), name="preferences"),
    path("modeles/", v.ModelesView.as_view(), name="modeles"),
    path("modeles/apercu/", v.ApercuView.as_view(), name="apercu"),
    path("modeles/<str:evenement>/<str:langue>/", v.ModeleView.as_view(), name="modele"),
    path("envois/", v.EnvoisView.as_view(), name="envois"),
    path("envois/resume/", v.ResumeEnvoisView.as_view(), name="envois-resume"),
    path("envois/<int:pk>/reessayer/", v.ReessayerView.as_view(), name="reessayer"),
    path("<int:pk>/lue/", v.MarquerLueEquipeView.as_view(), name="lue"),
]
