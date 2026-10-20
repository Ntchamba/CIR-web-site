"""Serveur ASGI (daphne) : HTTP (Django) et WebSocket (Channels, `/ws/`)."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from config.origine import valider_origine  # noqa: E402
from config.routing import websocket_urlpatterns  # noqa: E402

# L'authentification se fait par la première trame du WebSocket (jeton JWT), pas dans l'adresse.
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": valider_origine(URLRouter(websocket_urlpatterns)),
    }
)
