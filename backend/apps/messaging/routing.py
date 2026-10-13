from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/messagerie/<int:conversation_id>/", consumers.ConversationConsumer.as_asgi()),
    path("ws/notifications/", consumers.NotificationsConsumer.as_asgi()),
]
