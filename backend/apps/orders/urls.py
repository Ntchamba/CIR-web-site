from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.CommandesView, basename="commandes")
urlpatterns = router.urls
