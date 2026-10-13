from rest_framework import serializers

from .models import Caracteristique, Famille, ImageProduit, Produit


class FamilleSerializer(serializers.ModelSerializer):
    nb_produits = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Famille
        fields = ["id", "nom", "slug", "description", "ordre", "nb_produits"]
        read_only_fields = ["slug"]


class ImageProduitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageProduit
        fields = ["id", "image", "alt", "ordre"]


class CaracteristiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caracteristique
        fields = ["id", "libelle", "valeur", "ordre"]


class ProduitListeSerializer(serializers.ModelSerializer):
    """Vignette du catalogue."""

    famille = serializers.CharField(source="famille.nom", read_only=True)
    famille_slug = serializers.CharField(source="famille.slug", read_only=True)
    vignette = serializers.SerializerMethodField()
    usages = serializers.ListField(read_only=True)

    class Meta:
        model = Produit
        fields = ["id", "nom", "slug", "reference", "famille", "famille_slug", "accroche", "prix", "unite_prix",
                  "usages", "vignette", "a_la_une", "est_nouveau"]

    def get_vignette(self, produit):
        images = list(produit.images.all())
        if not images:
            return None
        requete = self.context.get("request")
        url = images[0].image.url
        return requete.build_absolute_uri(url) if requete else url


class ProduitDetailSerializer(ProduitListeSerializer):
    """Fiche produit complète (BF-05, BF-06)."""

    images = ImageProduitSerializer(many=True, read_only=True)
    caracteristiques = CaracteristiqueSerializer(many=True, read_only=True)

    class Meta(ProduitListeSerializer.Meta):
        fields = ProduitListeSerializer.Meta.fields + [
            "description", "durabilite", "beaute", "confort", "mise_en_oeuvre", "images", "caracteristiques"]


class ProduitAdminSerializer(serializers.ModelSerializer):
    """Gestion du catalogue depuis le dashboard (BF-14)."""

    famille_nom = serializers.CharField(source="famille.nom", read_only=True)
    images = ImageProduitSerializer(many=True, read_only=True)
    caracteristiques = CaracteristiqueSerializer(many=True, required=False)
    vignette = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = ["id", "nom", "slug", "reference", "famille", "famille_nom", "accroche", "description",
                  "pour_maison", "pour_industrie", "pour_entreprise", "pour_exterieur", "prix", "unite_prix",
                  "durabilite", "beaute", "confort", "mise_en_oeuvre", "en_ligne", "a_la_une", "est_nouveau",
                  "ordre", "images", "caracteristiques", "vignette", "modifie_le"]
        read_only_fields = ["slug", "modifie_le"]

    def get_vignette(self, produit):
        image = produit.images.first()
        if not image:
            return None
        requete = self.context.get("request")
        return requete.build_absolute_uri(image.image.url) if requete else image.image.url

    def _caracteristiques(self, produit, lignes):
        if lignes is None:
            return
        produit.caracteristiques.all().delete()
        Caracteristique.objects.bulk_create(
            [Caracteristique(produit=produit, ordre=i, **{k: v for k, v in l.items() if k in ("libelle", "valeur")})
             for i, l in enumerate(lignes)])

    def create(self, validated_data):
        lignes = validated_data.pop("caracteristiques", None)
        produit = super().create(validated_data)
        self._caracteristiques(produit, lignes)
        return produit

    def update(self, instance, validated_data):
        lignes = validated_data.pop("caracteristiques", None)
        produit = super().update(instance, validated_data)
        self._caracteristiques(produit, lignes)
        return produit
