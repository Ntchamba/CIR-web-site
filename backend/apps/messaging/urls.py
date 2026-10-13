from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("conversations", views.ConversationsView, basename="conversations")
urlpatterns = router.urls
