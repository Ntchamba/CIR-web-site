from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.ListeNotificationsView.as_view(), name="liste"),
    path("non-lues/", views.NonLuesView.as_view(), name="non-lues"),
    path("lues/", views.MarquerToutesLuesView.as_view(), name="lues"),
    path("preferences/", views.PreferencesView.as_view(), name="preferences"),
    path("desabonnement/", views.desabonnement, name="desabonnement"),
    path("<int:pk>/lue/", views.MarquerLueView.as_view(), name="lue"),
]
