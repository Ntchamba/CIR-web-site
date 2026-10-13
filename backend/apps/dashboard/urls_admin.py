from django.urls import path

from . import views

urlpatterns = [path("", views.statistiques, name="admin-statistiques")]
