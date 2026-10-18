"""Sérialiseurs de la sélection : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from rest_framework import serializers

from apps.catalogue.serializers import DesignPublicSerializer, ProduitCarteSerializer

from .models import ElementSelection


class ProduitSelectionSerializer(ProduitCarteSerializer):
    class Meta(ProduitCarteSerializer.Meta):
        fields = ["id", "slug", "reference", "nom", "famille", "image", "prix", "unite_prix"]
        read_only_fields = fields


class ElementSerializer(serializers.ModelSerializer):
    produit = ProduitSelectionSerializer(read_only=True)
    design = DesignPublicSerializer(read_only=True)
    ajoute_le = serializers.DateTimeField(source="cree_le", read_only=True)
    disponible = serializers.SerializerMethodField()

    class Meta:
        model = ElementSelection
        fields = ["id", "produit", "design", "ajoute_le", "disponible"]
        read_only_fields = fields

    def get_disponible(self, element):
        return element.produit.en_ligne


class AjoutSerializer(serializers.Serializer):
    """Forme de la demande d'ajout ; l'existence du produit et du design est contrôlée par le service."""

    produit = serializers.IntegerField()
    design = serializers.IntegerField(required=False, allow_null=True, default=None)
