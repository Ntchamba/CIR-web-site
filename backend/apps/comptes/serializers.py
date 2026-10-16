"""Sérialiseurs des comptes : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from rest_framework import serializers

from . import services
from .models import Utilisateur
from .roles import ROLES_EQUIPE, Role


class UtilisateurSerializer(serializers.ModelSerializer):
    """Profil de l'utilisateur connecté (/api/comptes/moi/)."""

    adresse_complete = serializers.BooleanField(read_only=True)
    adresse_formatee = serializers.CharField(read_only=True)
    est_equipe = serializers.BooleanField(read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id", "email", "nom_complet", "telephone", "role", "est_equipe",
            "ville", "quartier", "rue_ou_repere", "adresse_complete", "adresse_formatee", "date_inscription",
        ]
        read_only_fields = ["id", "email", "role", "date_inscription"]

    def update(self, instance, validated_data):
        return services.mettre_a_jour_profil(instance, validated_data)


class InscriptionSerializer(serializers.Serializer):
    email = serializers.EmailField()
    mot_de_passe = serializers.CharField(write_only=True, style={"input_type": "password"})
    nom_complet = serializers.CharField(max_length=150)
    telephone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    ville = serializers.CharField(max_length=80)
    quartier = serializers.CharField(max_length=80)
    rue_ou_repere = serializers.CharField(max_length=200)

    def create(self, validated_data):
        return services.inscrire_client(**validated_data)


# --- Tableau de bord ---

class MembreEquipeSerializer(serializers.ModelSerializer):
    actif = serializers.BooleanField(source="is_active", read_only=True)
    derniere_connexion = serializers.DateTimeField(source="last_login", read_only=True)
    mot_de_passe = serializers.CharField(write_only=True, style={"input_type": "password"})
    role = serializers.ChoiceField(choices=[(r.value, r.label) for r in ROLES_EQUIPE], default=Role.MEMBRE)

    class Meta:
        model = Utilisateur
        fields = ["id", "email", "nom_complet", "telephone", "role", "actif", "mot_de_passe",
                  "date_inscription", "derniere_connexion"]
        read_only_fields = ["id", "date_inscription"]
        extra_kwargs = {"email": {"validators": []}}  # unicité contrôlée par services.py

    def create(self, validated_data):
        return services.ajouter_membre(self.context["request"].user, **validated_data)


class ClientListeSerializer(serializers.ModelSerializer):
    actif = serializers.BooleanField(source="is_active", read_only=True)
    adresse_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = Utilisateur
        fields = ["id", "email", "nom_complet", "telephone", "ville", "quartier", "adresse_complete",
                  "actif", "date_inscription"]
        read_only_fields = fields


class ClientDetailSerializer(ClientListeSerializer):
    adresse_formatee = serializers.CharField(read_only=True)
    derniere_connexion = serializers.DateTimeField(source="last_login", read_only=True)

    class Meta(ClientListeSerializer.Meta):
        fields = ClientListeSerializer.Meta.fields + ["rue_ou_repere", "adresse_formatee", "derniere_connexion"]
        read_only_fields = fields
