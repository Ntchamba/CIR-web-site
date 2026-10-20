from django.urls import path

from . import views

app_name = "appels"

urlpatterns = [
    path("disponibilite/", views.DisponibiliteView.as_view(), name="disponibilite"),
    path("", views.AppelsView.as_view(), name="lancer"),
    path("webhooks/jaas/", views.WebhookJaasView.as_view(), name="webhook-jaas"),
    path("<int:pk>/", views.AppelView.as_view(), name="detail"),
    path("<int:pk>/annuler/", views.AnnulerView.as_view(), name="annuler"),
    path("<int:pk>/terminer/", views.TerminerView.as_view(), name="terminer"),
]
