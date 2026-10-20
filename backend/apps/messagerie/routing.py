"""Routes WebSocket de la messagerie (le WebSocket unique `/ws/` sert aussi aux notifications et aux appels)."""
from django.urls import re_path

from .consumers import ConsommateurDirect

websocket_urlpatterns = [
    re_path(r"^ws/$", ConsommateurDirect.as_asgi()),
]
