from django.urls import path

from . import views_admin as v

app_name = "paiements_admin"

urlpatterns = [
    path("", v.PaiementsView.as_view(), name="liste"),
    path("resume/", v.ResumeView.as_view(), name="resume"),
    path("commandes/<int:commande_id>/reglements/", v.ReglementView.as_view(), name="reglement"),
    path("<int:pk>/", v.PaiementView.as_view(), name="detail"),
    path("<int:pk>/reverifier/", v.ReverifierView.as_view(), name="reverifier"),
]
