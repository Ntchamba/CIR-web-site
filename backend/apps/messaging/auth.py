"""Authentification des WebSocket par jeton JWT (?jeton=<access>), le navigateur ne pouvant pas
envoyer d'en-tête Authorization à l'ouverture d'un WebSocket."""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def utilisateur_du_jeton(jeton):
    try:
        acces = AccessToken(jeton)
        return get_user_model().objects.get(pk=acces["user_id"], is_active=True)
    except (TokenError, KeyError, get_user_model().DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        parametres = parse_qs(scope.get("query_string", b"").decode())
        jeton = (parametres.get("jeton") or [None])[0]
        scope["user"] = await utilisateur_du_jeton(jeton) if jeton else AnonymousUser()
        return await super().__call__(scope, receive, send)
