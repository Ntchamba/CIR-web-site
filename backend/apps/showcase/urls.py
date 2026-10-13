from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("realisations", views.RealisationsView, basename="realisations")
router.register("demos", views.DemosView, basename="demos")
router.register("temoignages", views.TemoignagesView, basename="temoignages")
urlpatterns = router.urls
