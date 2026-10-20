"""Mise en forme des notifications et des envois (voir `services.py`)."""
from rest_framework import serializers

from . import services
from .models import EnvoiEmail


class NotificationSerializer(serializers.Serializer):
    """<Notification> : le texte est produit à la lecture, dans la langue de la requête."""

    def to_representation(self, notification):
        return services.notification_en_dict(notification, self.context.get("equipe"))


class PreferencesClientSerializer(serializers.Serializer):
    recevoir_nouveautes = serializers.BooleanField()


class PreferencesEquipeSerializer(serializers.Serializer):
    email_equipe = serializers.BooleanField()


class ModeleSerializer(serializers.Serializer):
    sujet = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False, default="")
    introduction = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False, default="")


class ApercuSerializer(serializers.Serializer):
    evenement = serializers.CharField()
    langue = serializers.CharField()
    sujet = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False, default="")
    introduction = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False, default="")


class EnvoiSerializer(serializers.ModelSerializer):
    destinataire_email = serializers.SerializerMethodField()
    derniere_erreur = serializers.SerializerMethodField()
    derniere_erreur_code = serializers.CharField(source="derniere_erreur", read_only=True)

    class Meta:
        model = EnvoiEmail
        fields = ["id", "destinataire_email", "evenement", "etat", "tentatives", "derniere_erreur",
                  "derniere_erreur_code", "cree_le", "envoye_le"]
        read_only_fields = fields

    def get_derniere_erreur(self, envoi):
        return str(services.texte_erreur_envoi(envoi.derniere_erreur))

    def get_destinataire_email(self, envoi):
        return services.masquer_email(envoi.destinataire_email)
