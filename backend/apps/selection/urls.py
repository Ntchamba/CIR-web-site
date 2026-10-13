from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.SelectionView, basename="selection")
urlpatterns = router.urls
