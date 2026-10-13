from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.NouveautesView, basename="nouveautes")
urlpatterns = router.urls
