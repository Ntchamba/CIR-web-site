from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("sphere", views.PhotosSphereAdminView, basename="admin-sphere")

urlpatterns = [
    path("accueil/", views.ContenuAccueilAdminView.as_view(), name="admin-contenu-accueil"),
    *router.urls,
]
