from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("familles", views.FamillesView, basename="familles")
router.register("produits", views.ProduitsView, basename="produits")
urlpatterns = router.urls
