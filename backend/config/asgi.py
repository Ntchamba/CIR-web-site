"""Serveur ASGI : HTTP (Django) + WebSocket (messagerie instantanée)."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

from apps.messaging.auth import JWTAuthMiddleware  # noqa: E402
from apps.messaging.routing import websocket_urlpatterns  # noqa: E402

# Seuls le site public et le dashboard (origines autorisées par CORS) ouvrent un WebSocket.
origines = ["*"] if settings.DEBUG else list(settings.CORS_ALLOWED_ORIGINS)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": OriginValidator(JWTAuthMiddleware(URLRouter(websocket_urlpatterns)), origines),
    }
)
