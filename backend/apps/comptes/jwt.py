"""Jetons JWT d'accès et de rafraîchissement (simplejwt), enrichis du nom et du rôle."""
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


def ajouter_revendications(jeton, utilisateur):
    jeton["nom_complet"] = utilisateur.nom_complet
    jeton["role"] = utilisateur.role
    return jeton


def jetons_pour(utilisateur):
    """Renvoie {"acces", "rafraichissement"} pour un utilisateur (ex. juste après l'inscription)."""
    rafraichissement = ajouter_revendications(RefreshToken.for_user(utilisateur), utilisateur)
    return {"acces": str(rafraichissement.access_token), "rafraichissement": str(rafraichissement)}


class ConnexionSerializer(TokenObtainPairSerializer):
    """Entrée : {"email", "mot_de_passe"}. Sortie : {"acces", "rafraichissement", "utilisateur"}."""

    default_error_messages = {"no_active_account": _("E-mail ou mot de passe incorrect.")}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop("password")
        self.fields["mot_de_passe"] = serializers.CharField(write_only=True, style={"input_type": "password"})

    @classmethod
    def get_token(cls, user):
        return ajouter_revendications(super().get_token(user), user)

    def validate(self, attrs):
        attrs = dict(attrs)
        attrs["password"] = attrs.pop("mot_de_passe")
        attrs[self.username_field] = str(attrs.get(self.username_field, "")).strip().lower()
        donnees = super().validate(attrs)
        self.verifier_acces(self.user)
        from .serializers import UtilisateurSerializer  # import local : évite une boucle

        return {
            "acces": donnees["access"],
            "rafraichissement": donnees["refresh"],
            "utilisateur": UtilisateurSerializer(self.user).data,
        }

    def verifier_acces(self, utilisateur):
        """Point d'extension : la connexion de l'équipe refuse les comptes clients."""


class ConnexionEquipeSerializer(ConnexionSerializer):
    def verifier_acces(self, utilisateur):
        if not utilisateur.est_equipe:
            raise serializers.ValidationError({"detail": _("Ce compte n'a pas accès au tableau de bord.")})
