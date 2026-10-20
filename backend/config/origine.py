"""Contrôle de l'origine des connexions WebSocket.

Comme `AllowedHostsOriginValidator` de Channels (hôtes de `ALLOWED_HOSTS`), mais accepte aussi les origines du site et
du tableau de bord (`CORS_ALLOWED_ORIGINS`), qui sont sur d'autres domaines que l'API.
"""
from channels.security.websocket import OriginValidator
from django.conf import settings


def valider_origine(application):
    hotes = list(settings.ALLOWED_HOSTS)
    if settings.DEBUG and not hotes:
        hotes = ["localhost", "127.0.0.1", "[::1]"]
    return OriginValidator(application, [*hotes, *settings.CORS_ALLOWED_ORIGINS])
