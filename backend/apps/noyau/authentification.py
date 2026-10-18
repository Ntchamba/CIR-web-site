"""Authentification facultative : pour les routes publiques qui reconnaissent un client connecté.

Un jeton absent, périmé ou invalide ne bloque pas la requête (pas de 401) : le visiteur reste anonyme.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed


class AuthentificationFacultative(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:  # parente de InvalidToken : jeton périmé, compte désactivé ou supprimé
            return None
