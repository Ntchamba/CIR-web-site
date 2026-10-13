from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.CommandesAdminView, basename="admin-commandes")
urlpatterns = router.urls
