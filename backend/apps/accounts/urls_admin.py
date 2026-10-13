from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("clients", views.ClientsAdminViewSet, basename="admin-clients")
router.register("equipe", views.EquipeAdminViewSet, basename="admin-equipe")

urlpatterns = [
    path("connexion/", views.ConnexionEquipeView.as_view(), name="admin-connexion"),
    *router.urls,
]
