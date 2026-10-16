"""Sérialiseurs de la vitrine : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.catalogue.models import Produit, Usage
from apps.catalogue.serializers import ProduitResumeSerializer
from apps.noyau.champs import RelationsJSON
from apps.noyau.medias import objet_image, url_absolue, valider_video
from apps.noyau.traductions import SerialiseurTraductionsAdminMixin, SerialiseurTraduitMixin

from . import services
from .models import Demo, Realisation, StatutTemoignage, Temoignage


def _requete(serialiseur):
    return serialiseur.context.get("request")


# --- API publique ---

class RealisationPublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    image_avant = serializers.SerializerMethodField()
    image_apres = serializers.SerializerMethodField()
    produits = serializers.SerializerMethodField()

    class Meta:
        model = Realisation
        fields = ["id", "slug", "titre", "type_chantier", "ville", "description", "image_avant", "image_apres",
                  "date", "produits"]
        read_only_fields = fields

    def get_image_avant(self, realisation):
        alt = _("%(titre)s, avant les travaux") % {"titre": realisation.traduit("titre")}
        return objet_image(_requete(self), realisation.image_avant, alt)

    def get_image_apres(self, realisation):
        alt = _("%(titre)s, après les travaux") % {"titre": realisation.traduit("titre")}
        return objet_image(_requete(self), realisation.image_apres, alt)

    def get_produits(self, realisation):
        produits = [p for p in realisation.produits.all() if p.en_ligne]  # pas de lien vers une page 404
        return ProduitResumeSerializer(produits, many=True, context=self.context).data


class DemoPublicSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    video = serializers.SerializerMethodField()
    lien = serializers.SerializerMethodField()
    integration = serializers.SerializerMethodField()
    miniature = serializers.SerializerMethodField()

    class Meta:
        model = Demo
        fields = ["id", "titre", "description", "video", "lien", "integration", "miniature", "duree"]
        read_only_fields = fields

    def get_video(self, demo):
        return url_absolue(_requete(self), demo.video)

    def get_lien(self, demo):
        return demo.lien or None

    def get_integration(self, demo):
        return services.adresse_integration(demo.lien)

    def get_miniature(self, demo):
        return objet_image(_requete(self), demo.miniature, demo.traduit("titre"))


class TemoignagePublicSerializer(serializers.ModelSerializer):
    """Les mots du client ne sont pas traduits : `langue` indique leur langue d'écriture."""

    date = serializers.DateTimeField(source="cree_le", read_only=True)

    class Meta:
        model = Temoignage
        fields = ["id", "nom_affiche", "ville", "type_chantier", "texte", "note", "langue", "date"]
        read_only_fields = fields


class TemoignageMienSerializer(TemoignagePublicSerializer):
    motif_refus = serializers.SerializerMethodField()

    class Meta(TemoignagePublicSerializer.Meta):
        fields = TemoignagePublicSerializer.Meta.fields + ["statut", "motif_refus"]
        read_only_fields = fields

    def get_motif_refus(self, temoignage):
        return temoignage.motif_refus if temoignage.statut == StatutTemoignage.REFUSE else None


class TemoignageDepotSerializer(serializers.Serializer):
    texte = serializers.CharField(max_length=2000, trim_whitespace=False)
    note = serializers.IntegerField(min_value=1, max_value=5)
    ville = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    type_chantier = serializers.ChoiceField(choices=Usage.choices, required=False, allow_blank=True, default="")

    def create(self, validated_data):
        return services.deposer_temoignage(self.context["request"].user, **validated_data)

    def to_representation(self, instance):
        return TemoignageMienSerializer(instance, context=self.context).data


# --- API équipe ---

class RealisationAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    produits = RelationsJSON(child_relation=serializers.PrimaryKeyRelatedField(queryset=Produit.objects.all()),
                             required=False)

    class Meta:
        model = Realisation
        fields = ["id", "titre", "slug", "type_chantier", "ville", "description", "image_apres", "image_avant",
                  "produits", "publie", "date", "ordre", "cree_le", "traductions"]
        read_only_fields = ["id", "slug", "cree_le"]
        extra_kwargs = {"image_avant": {"allow_null": True, "required": False}}

    def create(self, validated_data):
        return services.enregistrer_realisation(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_realisation(instance, validated_data)


class DemoAdminSerializer(SerialiseurTraductionsAdminMixin, serializers.ModelSerializer):
    integration = serializers.SerializerMethodField()

    class Meta:
        model = Demo
        fields = ["id", "titre", "description", "video", "lien", "integration", "miniature", "duree",
                  "realisation", "publie", "ordre", "cree_le", "traductions"]
        read_only_fields = ["id", "cree_le"]
        extra_kwargs = {
            "video": {"allow_null": True, "required": False},
            "miniature": {"allow_null": True, "required": False},
        }

    def get_integration(self, demo):
        return services.adresse_integration(demo.lien)

    def validate_video(self, fichier):
        return valider_video(fichier)

    def create(self, validated_data):
        return services.enregistrer_demo(None, validated_data)

    def update(self, instance, validated_data):
        return services.enregistrer_demo(instance, validated_data)


class AuteurSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)
    nom_complet = serializers.CharField(read_only=True)


class TemoignageAdminSerializer(serializers.ModelSerializer):
    auteur = AuteurSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Temoignage
        fields = ["id", "auteur", "nom_affiche", "ville", "type_chantier", "texte", "note", "langue", "statut",
                  "motif_refus", "cree_le", "modere_le", "modere_par"]
        read_only_fields = fields


class RefusSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)
