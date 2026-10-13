from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.ContactView, basename="contact")
urlpatterns = router.urls
