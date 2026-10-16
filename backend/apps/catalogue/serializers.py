"""Sérialiseurs du catalogue : mise en forme et contrôle de forme. Les règles sont dans services.py.

- API publique : textes dans la langue de la requête (`SerialiseurTraduitMixin`), URL de médias absolues.
- API équipe : textes français + `traductions` + `langues_incompletes` (`SerialiseurTraductionsAdminMixin`).
"""
from rest_framework import serializers

from apps.noyau.champs import ListeJSONSerializer
from apps.noyau.medias import objet_image, url_absolue
from apps.noyau.traductions import SerialiseurTraductionsAdminMixin, SerialiseurTraduitMixin

from . import services
from .models import Caracteristique, Couche, Design, Famille, ImageProduit, Produit
from .prix import ChampPrix


def _requete(serialiseur):
    return serialiseur.context.get("request")


def _image_produit(request, image, produit):
    """Objet image public ; texte alternatif traduit, sinon le nom du produit."""
    return objet_image(request, image.image, image.traduit("alt") or produit.traduit("nom"))


# --- API publique ---

class FamillePublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    nombre_produits = serializers.IntegerField(read_only=True)

    class Meta:
        model = Famille
        fields = ["id", "nom", "slug", "description", "nombre_produits"]
        read_only_fields = fields


class FamilleResumeSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    class Meta:
        model = Famille
        fields = ["slug", "nom"]
        read_only_fields = fields


class ProduitResumeSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    """Produit cité ailleurs (réalisations, actualités, sphère) : {slug, nom}."""

    class Meta:
        model = Produit
        fields = ["slug", "nom"]
        read_only_fields = fields


class ProduitCarteSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    famille = FamilleResumeSerializer(read_only=True)
    usages = serializers.ListField(child=serializers.CharField(), read_only=True)
    prix = ChampPrix(read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = ["id", "slug", "reference", "nom", "accroche", "famille", "usages", "prix", "unite_prix", "image",
                  "est_nouveau", "a_la_une"]
        read_only_fields = fields

    def get_image(self, produit):
        images = list(produit.images.all())
        return _image_produit(_requete(self), images[0], produit) if images else None


class DesignPublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Design
        fields = ["id", "nom", "image", "couleur"]
        read_only_fields = fields

    def get_image(self, design):
        return objet_image(_requete(self), design.image, design.traduit("nom"))


class CaracteristiquePublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    class Meta:
        model = Caracteristique
        fields = ["libelle", "valeur"]
        read_only_fields = fields


class CouchePublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    class Meta:
        model = Couche
        fields = ["nom", "epaisseur"]
        read_only_fields = fields


class ProduitDetailSerializer(ProduitCarteSerializer):
    mise_en_oeuvre = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    designs = DesignPublicSerializer(many=True, read_only=True)
    caracteristiques = CaracteristiquePublicSerializer(many=True, read_only=True)
    couches = CouchePublicSerializer(many=True, read_only=True)

    class Meta(ProduitCarteSerializer.Meta):
        fields = ProduitCarteSerializer.Meta.fields + [
            "description", "domaine_application", "performances", "mise_en_oeuvre", "images", "designs",
            "caracteristiques", "couches",
        ]
        read_only_fields = fields

    def get_mise_en_oeuvre(self, produit):
        return {champ: produit.traduit(champ)
                for champ in ("preparation", "methode_application", "dosage", "conditions_chantier")}

    def get_images(self, produit):
        return [_image_produit(_requete(self), image, produit) for image in produit.images.all()]


# --- API équipe ---

class FamilleAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    nombre_produits = serializers.SerializerMethodField()

    class Meta:
        model = Famille
        fields = ["id", "nom", "slug", "description", "ordre", "traductions", "nombre_produits"]
        read_only_fields = ["id", "slug"]
        extra_kwargs = {"nom": {"validators": []}}  # unicité contrôlée par services.py

    def get_nombre_produits(self, famille):
        nombre = getattr(famille, "nombre_produits", None)
        return famille.produits.count() if nombre is None else nombre

    def create(self, validated_data):
        return services.enregistrer_famille(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_famille(instance, validated_data)


class CaracteristiqueAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    class Meta:
        model = Caracteristique
        fields = ["libelle", "valeur", "traductions"]
        list_serializer_class = ListeJSONSerializer


class CoucheAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    class Meta:
        model = Couche
        fields = ["nom", "epaisseur", "traductions"]
        list_serializer_class = ListeJSONSerializer


class ImageProduitAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ImageProduit
        fields = ["id", "url", "image", "alt", "ordre", "traductions"]
        read_only_fields = ["id"]
        extra_kwargs = {"image": {"write_only": True}}

    def get_url(self, image):
        return url_absolue(_requete(self), image.image)

    def create(self, validated_data):
        return services.ajouter_image(self.context["produit"], validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("image", None)  # le fichier ne se remplace pas : supprimer puis ajouter
        return services.modifier_image(instance, validated_data)


class DesignAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    class Meta:
        model = Design
        fields = ["id", "nom", "image", "couleur", "ordre", "traductions"]
        read_only_fields = ["id"]
        extra_kwargs = {"image": {"allow_null": True, "required": False}}

    def create(self, validated_data):
        return services.enregistrer_design(None, validated_data, produit=self.context["produit"])

    def update(self, instance, validated_data):
        return services.enregistrer_design(instance, validated_data)


class ProduitAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    prix = ChampPrix()
    caracteristiques = CaracteristiqueAdminSerializer(many=True, required=False)
    couches = CoucheAdminSerializer(many=True, required=False)
    images = ImageProduitAdminSerializer(many=True, read_only=True)
    designs = DesignAdminSerializer(many=True, read_only=True)

    class Meta:
        model = Produit
        fields = [
            "id", "famille", "reference", "nom", "slug", "accroche", "description", "domaine_application",
            "performances", "preparation", "methode_application", "dosage", "conditions_chantier",
            "pour_maison", "pour_industrie", "pour_entreprise", "pour_exterieur", "prix", "unite_prix",
            "en_ligne", "a_la_une", "est_nouveau", "ordre", "cree_le", "modifie_le", "traductions",
            "caracteristiques", "couches", "images", "designs",
        ]
        read_only_fields = ["id", "slug", "cree_le", "modifie_le"]
        validators = []  # référence unique : contrôlée par services.py

    def create(self, validated_data):
        return services.enregistrer_produit(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_produit(instance, validated_data)
