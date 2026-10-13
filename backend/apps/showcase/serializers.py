from rest_framework import serializers

from .models import Demo, PhotoRealisation, Realisation, Temoignage


class PhotoRealisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhotoRealisation
        fields = ["id", "image", "legende", "ordre"]


class RealisationSerializer(serializers.ModelSerializer):
    photos = PhotoRealisationSerializer(many=True, read_only=True)
    produits_noms = serializers.SlugRelatedField(source="produits", slug_field="nom", many=True, read_only=True)
    type_chantier_libelle = serializers.CharField(source="get_type_chantier_display", read_only=True)

    class Meta:
        model = Realisation
        fields = ["id", "titre", "slug", "type_chantier", "type_chantier_libelle", "ville", "description", "image",
                  "image_avant", "produits", "produits_noms", "photos", "publie", "date", "ordre"]
        read_only_fields = ["slug"]


class DemoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Demo
        fields = ["id", "titre", "video", "lien", "miniature", "duree", "publie", "ordre"]


class TemoignageSerializer(serializers.ModelSerializer):
    type_batiment_libelle = serializers.CharField(source="get_type_batiment_display", read_only=True)

    class Meta:
        model = Temoignage
        fields = ["id", "nom_client", "type_batiment", "type_batiment_libelle", "ville", "texte", "note", "statut",
                  "cree_le"]
        read_only_fields = ["statut", "cree_le"]
