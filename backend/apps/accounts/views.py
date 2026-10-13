from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Sum
from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.permissions import EstEquipe, EstSuperAdministrateur

from .models import User
from .serializers import (
    ClientDetailSerializer,
    ClientListeSerializer,
    ConnexionEquipeSerializer,
    ConnexionSerializer,
    InscriptionSerializer,
    MembreEquipeSerializer,
    UtilisateurSerializer,
)


class InscriptionView(generics.CreateAPIView):
    """BF-08 : créer un compte (l'adresse peut être donnée tout de suite ou plus tard)."""

    serializer_class = InscriptionSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "inscription"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        return Response(UtilisateurSerializer(utilisateur).data, status=status.HTTP_201_CREATED)


class ConnexionView(TokenObtainPairView):
    """Connexion par e-mail et mot de passe. Bloquée 15 minutes après 5 essais incorrects (BNF-01)."""

    serializer_class = ConnexionSerializer
    permission_classes = [AllowAny]

    def _cle(self, request):
        email = str(request.data.get("email", "")).lower()
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0]
        return f"cir:connexion:{email}:{ip}"

    def post(self, request, *args, **kwargs):
        cle = self._cle(request)
        essais = cache.get(cle, 0)
        if essais >= settings.LOGIN_MAX_ATTEMPTS:
            return Response(
                {"detail": "Trop d'essais incorrects. Réessayez dans 15 minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            cache.set(cle, essais + 1, settings.LOGIN_LOCK_SECONDS)
            return Response({"detail": "E-mail ou mot de passe incorrect."}, status=status.HTTP_401_UNAUTHORIZED)
        except ValidationError as erreur:
            cache.set(cle, essais + 1, settings.LOGIN_LOCK_SECONDS)
            detail = erreur.detail.get("detail") if isinstance(erreur.detail, dict) else None
            message = detail[0] if isinstance(detail, list) else detail
            return Response({"detail": str(message or "Champs manquants.")}, status=status.HTTP_400_BAD_REQUEST)
        cache.delete(cle)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class ConnexionEquipeView(ConnexionView):
    """Connexion au tableau de bord : refusée aux comptes clients."""

    serializer_class = ConnexionEquipeSerializer


class MoiView(generics.RetrieveUpdateAPIView):
    """Profil du client connecté, y compris son adresse."""

    serializer_class = UtilisateurSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# --- Tableau de bord ---

def clients_annotes():
    return (
        User.objects.filter(is_staff=False)
        .select_related("adresse")
        .annotate(nb_commandes=Count("commandes", distinct=True),
                  surface_totale=Sum("commandes__lignes__surface_m2"))
    )


class ClientsAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                          viewsets.GenericViewSet):
    """BF-17 : comptes clients (consultation, désactivation)."""

    permission_classes = [EstEquipe]
    filterset_fields = ["type_client", "is_active"]
    search_fields = ["nom_complet", "email", "telephone", "adresse__ville"]
    ordering_fields = ["date_joined", "nom_complet", "nb_commandes"]

    def get_queryset(self):
        return clients_annotes()

    def get_serializer_class(self):
        return ClientDetailSerializer if self.action == "retrieve" else ClientListeSerializer

    def partial_update(self, request, *args, **kwargs):
        client = self.get_object()
        if "is_active" in request.data:
            client.is_active = bool(request.data["is_active"])
            client.save(update_fields=["is_active"])
        return Response(ClientDetailSerializer(self.get_queryset().get(pk=client.pk)).data)


class EquipeAdminViewSet(viewsets.ModelViewSet):
    """BF-17 : accès des administrateurs (super-administrateur uniquement)."""

    serializer_class = MembreEquipeSerializer
    permission_classes = [EstSuperAdministrateur]
    queryset = User.objects.filter(is_staff=True).order_by("nom_complet")
    http_method_names = ["get", "post", "patch", "head", "options"]
