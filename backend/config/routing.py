"""Routes WebSocket (Channels) : le WebSocket unique `/ws/` (voir apps/messagerie/consumers.py)."""
from apps.messagerie.routing import websocket_urlpatterns as routes_messagerie

websocket_urlpatterns = [*routes_messagerie]
