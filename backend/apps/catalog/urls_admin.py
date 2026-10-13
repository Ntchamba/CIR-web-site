from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("familles", views.FamillesAdminView, basename="admin-familles")
router.register("produits", views.ProduitsAdminView, basename="admin-produits")
urlpatterns = router.urls
