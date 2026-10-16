"""API publique des comptes (/api/comptes/) : inscription, connexion, profil."""
from django.conf import settings
from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from . import services
from .jwt import ConnexionSerializer, jetons_pour
from .serializers import InscriptionSerializer, UtilisateurSerializer


def adresse_ip(request):
    """Adresse du client, selon REST_FRAMEWORK["NUM_PROXIES"] (même règle que les quotas de DRF) :
    0 → REMOTE_ADDR ; n → n-ième valeur en partant de la fin de X-Forwarded-For (ajoutée par le proxy)."""
    return BaseThrottle().get_ident(request)


class InscriptionView(generics.CreateAPIView):
    """BF-08 : création d'un compte client avec adresse ; renvoie le profil et les jetons."""

    serializer_class = InscriptionSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # un vieux jeton envoyé par le navigateur ne doit pas bloquer (401)
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "inscription"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        return Response(
            {"utilisateur": UtilisateurSerializer(utilisateur).data, **jetons_pour(utilisateur)},
            status=status.HTTP_201_CREATED,
        )


class ConnexionView(generics.GenericAPIView):
    """Connexion par e-mail et mot de passe ; blocage de 15 minutes après 5 échecs (BNF-01)."""

    serializer_class = ConnexionSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        cle = services.cle_connexion(request.data.get("email", ""))
        cle_ip = services.cle_connexion_ip(adresse_ip(request))
        if services.connexion_bloquee(cle) or services.connexion_bloquee(cle_ip, settings.CONNEXION_ESSAIS_MAX_IP):
            return Response({"detail": "Trop d'essais incorrects. Réessayez dans 15 minutes."},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            services.enregistrer_echec_connexion(cle)
            services.enregistrer_echec_connexion(cle_ip)
            return Response({"detail": "E-mail ou mot de passe incorrect."}, status=status.HTTP_401_UNAUTHORIZED)
        except ValidationError as erreur:
            detail = erreur.detail.get("detail") if isinstance(erreur.detail, dict) else None
            if detail is None:  # champs manquants : pas compté comme un essai
                raise
            services.enregistrer_echec_connexion(cle)
            services.enregistrer_echec_connexion(cle_ip)
            message = detail[0] if isinstance(detail, list) else detail
            return Response({"detail": str(message)}, status=status.HTTP_403_FORBIDDEN)
        services.reinitialiser_essais_connexion(cle)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class _ChampsFrancaisMixin:
    """Accepte {"rafraichissement": ...} et renvoie {"acces", "rafraichissement"}."""

    def post(self, request, *args, **kwargs):
        donnees = {"refresh": request.data.get("rafraichissement", request.data.get("refresh", ""))}
        serializer = self.get_serializer(data=donnees)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as erreur:
            raise InvalidToken(erreur.args[0]) from erreur
        resultat = serializer.validated_data
        reponse = {}
        if "access" in resultat:
            reponse["acces"] = resultat["access"]
        if "refresh" in resultat:
            reponse["rafraichissement"] = resultat["refresh"]
        return Response(reponse, status=status.HTTP_200_OK)


class RafraichissementView(_ChampsFrancaisMixin, TokenRefreshView):
    """Nouveau jeton d'accès à partir du jeton de rafraîchissement (rotation activée)."""


class DeconnexionView(_ChampsFrancaisMixin, TokenBlacklistView):
    """Invalide le jeton de rafraîchissement (liste noire)."""


class MoiView(generics.RetrieveUpdateAPIView):
    """Profil de l'utilisateur connecté : lecture (GET) et modification (PATCH/PUT)."""

    serializer_class = UtilisateurSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True  # PUT comme PATCH : seuls les champs envoyés changent
        return super().update(request, *args, **kwargs)
