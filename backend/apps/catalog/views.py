import django_filters
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import EstEquipe

from .models import Famille, ImageProduit, Produit
from .serializers import (
    FamilleSerializer,
    ImageProduitSerializer,
    ProduitAdminSerializer,
    ProduitDetailSerializer,
    ProduitListeSerializer,
)

USAGES = {"maison": "pour_maison", "industrie": "pour_industrie", "entreprise": "pour_entreprise",
          "exterieur": "pour_exterieur"}


class FiltreProduits(django_filters.FilterSet):
    famille = django_filters.CharFilter(field_name="famille__slug")
    usage = django_filters.CharFilter(method="filtrer_usage")
    une = django_filters.BooleanFilter(field_name="a_la_une")
    nouveau = django_filters.BooleanFilter(field_name="est_nouveau")

    class Meta:
        model = Produit
        fields = ["famille", "usage", "une", "nouveau"]

    def filtrer_usage(self, queryset, nom, valeur):
        champ = USAGES.get(valeur)
        return queryset.filter(**{champ: True}) if champ else queryset


class FamillesView(viewsets.ReadOnlyModelViewSet):
    """BF-01 : familles du catalogue avec le nombre de produits en ligne."""

    permission_classes = [AllowAny]
    serializer_class = FamilleSerializer
    pagination_class = None
    queryset = Famille.objects.annotate(nb_produits=Count("produits", filter=Q(produits__en_ligne=True)))
    lookup_field = "slug"


class ProduitsView(viewsets.ReadOnlyModelViewSet):
    """BF-01, BF-05, BF-06 : catalogue public (produits visibles uniquement)."""

    permission_classes = [AllowAny]
    filterset_class = FiltreProduits
    search_fields = ["nom", "reference", "accroche", "famille__nom"]
    ordering_fields = ["ordre", "nom", "prix", "cree_le"]
    lookup_field = "slug"

    def get_queryset(self):
        return (Produit.objects.filter(en_ligne=True).select_related("famille")
                .prefetch_related("images", "caracteristiques"))

    def get_serializer_class(self):
        return ProduitDetailSerializer if self.action == "retrieve" else ProduitListeSerializer


# --- Tableau de bord (BF-14) ---

class FamillesAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = FamilleSerializer
    pagination_class = None
    queryset = Famille.objects.annotate(nb_produits=Count("produits"))


class ProduitsAdminView(viewsets.ModelViewSet):
    permission_classes = [EstEquipe]
    serializer_class = ProduitAdminSerializer
    filterset_class = FiltreProduits
    search_fields = ["nom", "reference", "famille__nom"]
    ordering_fields = ["ordre", "nom", "prix", "modifie_le"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Produit.objects.select_related("famille").prefetch_related("images", "caracteristiques")

    @action(detail=False)
    def resume(self, request):
        """Chiffres de l'en-tête de la page Catalogue."""
        qs = Produit.objects.all()
        return Response({"total": qs.count(), "en_ligne": qs.filter(en_ligne=True).count(),
                         "a_la_une": qs.filter(a_la_une=True).count(),
                         "brouillons": qs.filter(en_ligne=False).count()})

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None):
        """Ajoute une ou plusieurs photos (champ « image », répétable). Converties en WebP."""
        produit = self.get_object()
        fichiers = request.FILES.getlist("image")
        if not fichiers:
            return Response({"image": "Aucun fichier reçu."}, status=status.HTTP_400_BAD_REQUEST)
        depart = produit.images.count()
        crees = [ImageProduit.objects.create(produit=produit, image=f, alt=produit.nom, ordre=depart + i)
                 for i, f in enumerate(fichiers)]
        return Response(ImageProduitSerializer(crees, many=True, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>\d+)")
    def supprimer_image(self, request, pk=None, image_id=None):
        produit = self.get_object()
        produit.images.filter(pk=image_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
