"""Sérialiseurs des actualités : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from rest_framework import serializers

from apps.catalogue.serializers import ProduitResumeSerializer
from apps.noyau.medias import objet_image
from apps.noyau.traductions import SerialiseurTraductionsAdminMixin, SerialiseurTraduitMixin

from . import services
from .models import Actualite


class ActualitePublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    produit = serializers.SerializerMethodField()

    class Meta:
        model = Actualite
        fields = ["id", "slug", "titre", "resume", "texte", "image", "produit", "publie_le"]
        read_only_fields = fields

    def get_image(self, actualite):
        return objet_image(self.context.get("request"), actualite.image, actualite.traduit("titre"))

    def get_produit(self, actualite):
        produit = actualite.produit
        if produit is None or not produit.en_ligne:  # pas de lien vers une page 404
            return None
        return ProduitResumeSerializer(produit, context=self.context).data


class ActualiteAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    programmee = serializers.BooleanField(read_only=True)

    class Meta:
        model = Actualite
        fields = ["id", "titre", "slug", "resume", "texte", "image", "produit", "publie", "publie_le", "programmee",
                  "cree_le", "modifie_le", "traductions"]
        read_only_fields = ["id", "slug", "cree_le", "modifie_le"]
        extra_kwargs = {
            "image": {"allow_null": True, "required": False},
            "publie_le": {"allow_null": True, "required": False},
        }

    def create(self, validated_data):
        return services.enregistrer_actualite(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_actualite(instance, validated_data)
