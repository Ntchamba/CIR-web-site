"""Sérialiseurs de l'assistant : mise en forme et contrôle de forme. Les règles sont dans services.py."""
from rest_framework import serializers

from .models import Brouillon, ConversationAssistant, JournalAssistant, MessageAssistant


class MessageEntreeSerializer(serializers.Serializer):
    """Forme du message envoyé ; longueur, langue et contexte sont contrôlés dans services.py."""

    cle = serializers.UUIDField(required=False, allow_null=True, default=None)
    texte = serializers.CharField(trim_whitespace=False, allow_blank=True, max_length=20000)
    langue = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="", max_length=20)
    contexte = serializers.JSONField(required=False, default=dict)


class AvisSerializer(serializers.Serializer):
    utile = serializers.BooleanField()
    cle = serializers.UUIDField(required=False, allow_null=True, default=None)


class MessagePublicSerializer(serializers.ModelSerializer):
    """`bloque` est un simple booléen côté public (jamais le code interne ni le texte d'origine)."""

    bloque = serializers.SerializerMethodField()

    class Meta:
        model = MessageAssistant
        fields = ["id", "role", "texte", "liens", "bloque", "utile", "cree_le"]
        read_only_fields = fields

    def get_bloque(self, message):
        return bool(message.bloque)


class MessageAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAssistant
        fields = ["id", "role", "texte", "outils", "liens", "bloque", "utile", "jetons_entree", "jetons_sortie",
                  "duree_ms", "cree_le"]
        read_only_fields = fields


class ConversationAdminSerializer(serializers.ModelSerializer):
    utilisateur = serializers.IntegerField(source="utilisateur_id", read_only=True)  # identifiant seulement
    nombre_messages = serializers.SerializerMethodField()

    class Meta:
        model = ConversationAssistant
        fields = ["cle", "utilisateur", "langue", "contexte", "nombre_messages", "cree_le", "derniere_activite_le"]
        read_only_fields = fields

    def get_nombre_messages(self, conversation):
        annote = getattr(conversation, "nombre_messages", None)
        return annote if annote is not None else conversation.messages.count()


class ConversationDetailAdminSerializer(ConversationAdminSerializer):
    messages = MessageAdminSerializer(many=True, read_only=True)

    class Meta(ConversationAdminSerializer.Meta):
        fields = ConversationAdminSerializer.Meta.fields + ["messages"]
        read_only_fields = fields


class MembreSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom_complet = serializers.CharField()


class BrouillonSerializer(serializers.ModelSerializer):
    cree_par = MembreSerializer(read_only=True)
    traite_par = MembreSerializer(read_only=True)

    class Meta:
        model = Brouillon
        fields = ["id", "type", "cible_type", "cible_id", "langue", "contenu", "etat", "bloque", "cree_par",
                  "traite_par", "cree_le", "traite_le"]
        read_only_fields = fields


class JournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalAssistant
        fields = ["id", "agent", "utilisateur", "modele", "outils", "resultat", "code", "jetons_entree",
                  "jetons_sortie", "duree_ms", "cree_le"]
        read_only_fields = fields
