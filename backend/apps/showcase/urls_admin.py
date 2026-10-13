from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("realisations", views.RealisationsAdminView, basename="admin-realisations")
router.register("demos", views.DemosAdminView, basename="admin-demos")
router.register("temoignages", views.TemoignagesAdminView, basename="admin-temoignages")
urlpatterns = router.urls
