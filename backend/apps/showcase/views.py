from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import EstEquipe

from .models import Demo, PhotoRealisation, Realisation, Temoignage
from .serializers import DemoSerializer, PhotoRealisationSerializer, RealisationSerializer, TemoignageSerializer


class RealisationsView(viewsets.ReadOnlyModelViewSet):
    """BF-02 : réalisations publiées, filtrables par type de chantier."""

    permission_classes = [AllowAny]
    serializer_class = RealisationSerializer
    filterset_fields = ["type_chantier"]
    lookup_field = "slug"

    def get_queryset(self):
        return Realisation.objects.filter(publie=True).prefetch_related("photos", "produits")


class DemosView(viewsets.ReadOnlyModelViewSet):
    """BF-03 : démonstrations vidéo."""

    permission_classes = [AllowAny]
    serializer_class = DemoSerializer
    pagination_class = None
    queryset = Demo.objects.filter(publie=True)


class TemoignagesView(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """BF-04 : témoignages publiés ; un client connecté peut en proposer un (validé ensuite par l'équipe)."""

    serializer_class = TemoignageSerializer
    filterset_fields = ["type_batiment"]

    def get_permissions(self):
        return [IsAuthenticated()] if self.action == "create" else [AllowAny()]

    def get_queryset(self):
        return Temoignage.objects.filter(statut=Temoignage.Statut.PUBLIE)

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user, statut=Temoignage.Statut.EN_ATTENTE)


# --- Tableau de bord (BF-15) ---

class RealisationsAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = RealisationSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["type_chantier", "publie"]
    search_fields = ["titre", "ville"]
    queryset = Realisation.objects.prefetch_related("photos", "produits")

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def photos(self, request, pk=None):
        realisation = self.get_object()
        crees = [PhotoRealisation.objects.create(realisation=realisation, image=f)
                 for f in request.FILES.getlist("image")]
        return Response(PhotoRealisationSerializer(crees, many=True, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)


class DemosAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = DemoSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None
    queryset = Demo.objects.all()


class TemoignagesAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = TemoignageSerializer
    filterset_fields = ["statut", "type_batiment"]
    queryset = Temoignage.objects.all()

    @action(detail=True, methods=["post"])
    def publier(self, request, pk=None):
        temoignage = self.get_object()
        temoignage.statut = Temoignage.Statut.PUBLIE
        temoignage.save(update_fields=["statut"])
        return Response(self.get_serializer(temoignage).data)

    @action(detail=True, methods=["post"])
    def refuser(self, request, pk=None):
        temoignage = self.get_object()
        temoignage.statut = Temoignage.Statut.REFUSE
        temoignage.save(update_fields=["statut"])
        return Response(self.get_serializer(temoignage).data)
