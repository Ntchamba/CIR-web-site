from django.urls import path

from . import views

app_name = "paiements"

urlpatterns = [
    path("disponibilite/", views.DisponibiliteView.as_view(), name="disponibilite"),
    path("webhooks/campay/", views.WebhookCampayView.as_view(), name="webhook-campay"),
    path("", views.PaiementsView.as_view(), name="liste"),
    path("<int:pk>/", views.PaiementView.as_view(), name="detail"),
    path("<int:pk>/annuler/", views.AnnulerView.as_view(), name="annuler"),
    path("<int:pk>/recu/", views.RecuView.as_view(), name="recu"),
]
