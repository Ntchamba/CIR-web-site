from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.ContactAdminView, basename="admin-contact")
urlpatterns = router.urls
