"""Sérialiseurs des contenus de l'accueil : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from rest_framework import serializers

from apps.catalogue.serializers import ProduitResumeSerializer
from apps.noyau.medias import objet_image, url_absolue, valider_video
from apps.noyau.traductions import SerialiseurTraductionsAdminMixin, SerialiseurTraduitMixin

from . import services
from .models import Bandeau, ContenuAccueil, PhotoSphere


def _requete(serialiseur):
    return serialiseur.context.get("request")


# --- API publique ---

class BandeauPublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    class Meta:
        model = Bandeau
        fields = ["id", "texte", "lien"]
        read_only_fields = fields


class PhotoSpherePublicSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    produit = serializers.SerializerMethodField()

    class Meta:
        model = PhotoSphere
        fields = ["id", "image", "produit"]
        read_only_fields = fields

    def _produit_visible(self, photo):
        return photo.produit if photo.produit is not None and photo.produit.en_ligne else None

    def get_image(self, photo):
        produit = self._produit_visible(photo)
        alt = photo.traduit("alt") or (produit.traduit("nom") if produit else "")
        return objet_image(_requete(self), photo.image, alt)

    def get_produit(self, photo):
        produit = self._produit_visible(photo)  # pas de lien vers une page 404
        return ProduitResumeSerializer(produit, context=self.context).data if produit else None


class AccueilPublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    """Accueil en une seule réponse ; `bandeaux` et `sphere` sont passés dans le contexte."""

    video_fond = serializers.SerializerMethodField()
    image_affiche = serializers.SerializerMethodField()
    coordonnees = serializers.SerializerMethodField()
    bandeaux = serializers.SerializerMethodField()
    sphere = serializers.SerializerMethodField()

    class Meta:
        model = ContenuAccueil
        fields = ["titre", "accroche", "video_fond", "image_affiche", "texte_partenaire", "coordonnees", "bandeaux",
                  "sphere"]
        read_only_fields = fields

    def get_video_fond(self, contenu):
        return url_absolue(_requete(self), contenu.video_fond)

    def get_image_affiche(self, contenu):
        return objet_image(_requete(self), contenu.image_affiche, contenu.traduit("titre"))

    def get_coordonnees(self, contenu):
        return {"telephones": list(contenu.telephones or []), "whatsapp": contenu.whatsapp, "email": contenu.email,
                "adresse": contenu.adresse}

    def get_bandeaux(self, contenu):
        return BandeauPublicSerializer(self.context.get("bandeaux", []), many=True, context=self.context).data

    def get_sphere(self, contenu):
        return PhotoSpherePublicSerializer(self.context.get("sphere", []), many=True, context=self.context).data


# --- API équipe ---

class AccueilAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    class Meta:
        model = ContenuAccueil
        fields = ["titre", "accroche", "video_fond", "image_affiche", "texte_partenaire", "telephones", "whatsapp",
                  "email", "adresse", "modifie_le", "traductions"]
        read_only_fields = ["modifie_le"]
        extra_kwargs = {
            "video_fond": {"allow_null": True, "required": False},
            "image_affiche": {"allow_null": True, "required": False},
        }

    def validate_video_fond(self, fichier):
        return valider_video(fichier, services.VIDEO_FOND_OCTETS_MAX)

    def update(self, instance, validated_data):
        return services.modifier_accueil(validated_data)


class BandeauAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    class Meta:
        model = Bandeau
        fields = ["id", "texte", "lien", "actif", "debut", "fin", "ordre", "traductions"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return services.enregistrer_bandeau(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_bandeau(instance, validated_data)


class PhotoSphereAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    class Meta:
        model = PhotoSphere
        fields = ["id", "image", "alt", "produit", "ordre", "traductions"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return services.enregistrer_photo(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_photo(instance, validated_data)


class OrdreSphereSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1))
