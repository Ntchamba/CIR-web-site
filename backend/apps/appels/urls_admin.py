from django.urls import path

from . import views_admin as v

app_name = "appels_admin"

urlpatterns = [
    path("", v.HistoriqueView.as_view(), name="historique"),
    path("en-attente/", v.EnAttenteView.as_view(), name="en-attente"),
    path("usage/", v.UsageView.as_view(), name="usage"),
    path("resume/", v.ResumeView.as_view(), name="resume"),
    path("<int:pk>/repondre/", v.RepondreView.as_view(), name="repondre"),
    path("<int:pk>/refuser/", v.RefuserView.as_view(), name="refuser"),
    path("<int:pk>/terminer/", v.TerminerEquipeView.as_view(), name="terminer"),
]
