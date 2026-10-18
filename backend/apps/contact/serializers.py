"""Sérialiseurs du contact : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from rest_framework import serializers

from apps.catalogue.serializers import ProduitResumeSerializer

from .models import Creneau, DemandeContact, EtatContact, TypeDemande


class DemandeEntreeSerializer(serializers.Serializer):
    """Forme du message envoyé ; les règles (visiteur, rappel, liens) sont dans services.py."""

    nom = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.CharField(max_length=254, required=False, allow_blank=True, default="")
    telephone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    type = serializers.ChoiceField(choices=TypeDemande.choices)
    creneau = serializers.ChoiceField(choices=Creneau.choices, required=False, allow_blank=True, default="")
    message = serializers.CharField(max_length=5000, trim_whitespace=False)
    produit = serializers.IntegerField(required=False, allow_null=True, default=None)
    site_web = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")


class DemandeMienneSerializer(serializers.ModelSerializer):
    produit = ProduitResumeSerializer(read_only=True)

    class Meta:
        model = DemandeContact
        fields = ["id", "reference", "type", "creneau", "message", "produit", "etat", "reponse_equipe", "cree_le",
                  "traitee_le"]
        read_only_fields = fields


class DemandeAdminSerializer(DemandeMienneSerializer):
    auteur = serializers.SerializerMethodField()

    class Meta(DemandeMienneSerializer.Meta):
        fields = DemandeMienneSerializer.Meta.fields + ["nom", "email", "telephone", "langue", "auteur",
                                                        "notes_internes"]
        read_only_fields = fields

    def get_auteur(self, demande):
        auteur = demande.auteur
        return {"id": auteur.pk, "nom_complet": auteur.nom_complet} if auteur else None


class DemandeMajSerializer(serializers.Serializer):
    etat = serializers.ChoiceField(choices=EtatContact.choices, required=False)
    reponse_equipe = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    notes_internes = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
