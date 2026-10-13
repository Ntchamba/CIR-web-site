from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("", views.NouveautesAdminView, basename="admin-nouveautes")
urlpatterns = router.urls
