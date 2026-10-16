"""API publique des comptes (/api/comptes/) : inscription, connexion, profil."""
from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from . import services
from .jwt import ConnexionSerializer, jetons_pour
from .serializers import InscriptionSerializer, UtilisateurSerializer


def adresse_ip(request):
    transmise = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return transmise.split(",")[0].strip() if transmise else request.META.get("REMOTE_ADDR", "")


class InscriptionView(generics.CreateAPIView):
    """BF-08 : création d'un compte client avec adresse ; renvoie le profil et les jetons."""

    serializer_class = InscriptionSerializer
    permission_classes = [AllowAny]
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
        cle = services.cle_connexion(request.data.get("email", ""), adresse_ip(request))
        if services.connexion_bloquee(cle):
            return Response({"detail": "Trop d'essais incorrects. Réessayez dans 15 minutes."},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            services.enregistrer_echec_connexion(cle)
            return Response({"detail": "E-mail ou mot de passe incorrect."}, status=status.HTTP_401_UNAUTHORIZED)
        except ValidationError as erreur:
            detail = erreur.detail.get("detail") if isinstance(erreur.detail, dict) else None
            if detail is None:  # champs manquants : pas compté comme un essai
                raise
            services.enregistrer_echec_connexion(cle)
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
