from django.contrib.auth import password_validation
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Adresse, User


class AdresseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Adresse
        fields = ["pays", "ville", "quartier", "rue_repere", "complement"]


class UtilisateurSerializer(serializers.ModelSerializer):
    adresse = AdresseSerializer(required=False, allow_null=True)
    a_une_adresse = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "nom_complet", "telephone", "type_client", "adresse", "a_une_adresse",
                  "is_staff", "is_superuser", "date_joined"]
        read_only_fields = ["id", "email", "is_staff", "is_superuser", "date_joined"]

    def update(self, instance, validated_data):
        adresse = validated_data.pop("adresse", None)
        instance = super().update(instance, validated_data)
        if adresse is not None:
            Adresse.objects.update_or_create(utilisateur=instance, defaults=adresse)
        return instance


class InscriptionSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    adresse = AdresseSerializer(required=False)

    class Meta:
        model = User
        fields = ["email", "password", "nom_complet", "telephone", "type_client", "adresse"]

    def validate_email(self, valeur):
        valeur = valeur.lower()
        if User.objects.filter(email=valeur).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse e-mail.")
        return valeur

    def validate(self, donnees):
        password_validation.validate_password(
            donnees["password"], User(email=donnees["email"], nom_complet=donnees.get("nom_complet", ""))
        )
        return donnees

    def create(self, validated_data):
        adresse = validated_data.pop("adresse", None)
        utilisateur = User.objects.create_user(**validated_data)
        if adresse:
            Adresse.objects.create(utilisateur=utilisateur, **adresse)
        return utilisateur


class ConnexionSerializer(TokenObtainPairSerializer):
    """Jeton JWT enrichi du nom et du rôle (affichés par le site et le dashboard)."""

    @classmethod
    def get_token(cls, user):
        jeton = super().get_token(user)
        jeton["nom_complet"] = user.nom_complet
        jeton["is_staff"] = user.is_staff
        return jeton

    def validate(self, attrs):
        attrs[self.username_field] = attrs.get(self.username_field, "").lower()
        donnees = super().validate(attrs)
        donnees["utilisateur"] = UtilisateurSerializer(self.user).data
        return donnees


class ConnexionEquipeSerializer(ConnexionSerializer):
    def validate(self, attrs):
        donnees = super().validate(attrs)
        if not self.user.is_staff:
            raise serializers.ValidationError({"detail": "Ce compte n'a pas accès au tableau de bord."})
        return donnees


# --- Tableau de bord (BF-17) ---

class ClientListeSerializer(serializers.ModelSerializer):
    ville = serializers.CharField(source="adresse.ville", default="", read_only=True)
    nb_commandes = serializers.IntegerField(read_only=True)
    initiales = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "nom_complet", "telephone", "type_client", "ville", "nb_commandes",
                  "a_une_adresse", "is_active", "date_joined", "initiales"]


class ClientDetailSerializer(ClientListeSerializer):
    adresse = AdresseSerializer(read_only=True)
    surface_totale = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta(ClientListeSerializer.Meta):
        fields = ClientListeSerializer.Meta.fields + ["adresse", "surface_totale"]


class MembreEquipeSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "email", "nom_complet", "telephone", "is_active", "is_superuser", "password", "last_login"]
        read_only_fields = ["id", "last_login"]

    def create(self, validated_data):
        mot_de_passe = validated_data.pop("password", None)
        if not mot_de_passe:
            raise serializers.ValidationError({"password": "Mot de passe obligatoire."})
        password_validation.validate_password(mot_de_passe)
        return User.objects.create_user(password=mot_de_passe, is_staff=True, **validated_data)

    def update(self, instance, validated_data):
        mot_de_passe = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if mot_de_passe:
            password_validation.validate_password(mot_de_passe, instance)
            instance.set_password(mot_de_passe)
            instance.save(update_fields=["password"])
        return instance
