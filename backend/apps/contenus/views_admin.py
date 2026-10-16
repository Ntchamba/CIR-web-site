"""API équipe des contenus (/api/admin/contenus/) : accueil, bandeaux, sphère de photos."""
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.noyau.permissions import EstEquipe

from . import services
from .models import Bandeau
from .serializers import AccueilAdminSerializer, BandeauAdminSerializer, OrdreSphereSerializer, \
    PhotoSphereAdminSerializer


class AccueilAdminView(generics.RetrieveUpdateAPIView):
    """GET et PATCH (multipart possible) du contenu de l'accueil."""

    serializer_class = AccueilAdminSerializer
    permission_classes = [EstEquipe]

    def get_object(self):
        return services.contenu_accueil()

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True  # PUT comme PATCH
        return super().update(request, *args, **kwargs)


class BandeauAdminViewSet(viewsets.ModelViewSet):
    serializer_class = BandeauAdminSerializer
    permission_classes = [EstEquipe]
    pagination_class = None
    filter_backends = []
    queryset = Bandeau.objects.all()

    def perform_destroy(self, instance):
        services.supprimer_bandeau(instance)


class PhotoSphereAdminViewSet(viewsets.ModelViewSet):
    serializer_class = PhotoSphereAdminSerializer
    permission_classes = [EstEquipe]
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        return services.photos_sphere()

    def perform_destroy(self, instance):
        services.supprimer_photo(instance)

    @action(detail=False, methods=["post"])
    def ordre(self, request):
        """Range les photos : {"ids": [3, 1, 2]}."""
        donnees = OrdreSphereSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        photos = services.ordonner_sphere(donnees.validated_data["ids"])
        return Response(self.get_serializer(photos, many=True).data)
