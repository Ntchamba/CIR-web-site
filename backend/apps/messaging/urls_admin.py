from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("conversations", views.ConversationsAdminView, basename="admin-conversations")
urlpatterns = router.urls
