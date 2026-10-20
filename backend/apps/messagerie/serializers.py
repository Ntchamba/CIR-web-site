"""Mise en forme des messages, conversations et pièces jointes. Les règles sont dans services.py."""
from rest_framework import serializers

from .models import Message, PieceJointe

APERCU_CARACTERES = 120


def chemin_piece(piece):
    return f"/api/messagerie/pieces-jointes/{piece.pk}/"


def piece_en_dict(piece, base_url=""):
    return {"id": piece.pk, "nom_original": piece.nom_original, "type": piece.type, "taille": piece.taille,
            "url": f"{base_url.rstrip('/')}{chemin_piece(piece)}" if base_url else chemin_piece(piece)}


def message_en_dict(message, base_url=""):
    """<Message> du contrat. Fonction simple (sans DRF) : utilisée aussi par le WebSocket."""
    commande = message.commande
    return {
        "id": message.pk,
        "conversation": message.conversation_id,
        "auteur_role": message.auteur_role,
        "auteur_nom": message.auteur.nom_complet,
        "texte": message.texte,
        "commande": {"id": commande.pk, "reference": commande.reference} if commande else None,
        "pieces_jointes": [piece_en_dict(p, base_url) for p in message.pieces_jointes.all()],
        "cree_le": serializers.DateTimeField().to_representation(message.cree_le),
        "lu_le": serializers.DateTimeField().to_representation(message.lu_le) if message.lu_le else None,
        "cle_client": message.cle_client,
    }


def base_url_de(request):
    """Adresse de l'API pour les liens absolus (le site et le tableau de bord sont sur d'autres domaines)."""
    return request.build_absolute_uri("/").rstrip("/") if request is not None else ""


class PieceJointeSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = PieceJointe
        fields = ["id", "nom_original", "type", "taille", "url"]
        read_only_fields = fields

    def get_url(self, piece):
        return piece_en_dict(piece, base_url_de(self.context.get("request")))["url"]


class MessageSerializer(serializers.Serializer):
    """Lecture d'un <Message> (voir `message_en_dict`)."""

    def to_representation(self, message):
        return message_en_dict(message, base_url_de(self.context.get("request")))


class EnvoiMessageSerializer(serializers.Serializer):
    """Corps d'un envoi : JSON (`pieces_jointes` = identifiants) ou multipart (`fichiers`)."""

    texte = serializers.CharField(required=False, allow_blank=True, default="", trim_whitespace=False)
    commande = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    cle_client = serializers.CharField(required=False, allow_blank=True, default="", trim_whitespace=False)
    pieces_jointes = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)


class LuSerializer(serializers.Serializer):
    jusqu_a = serializers.IntegerField(min_value=0)


class ConversationEquipeSerializer(serializers.Serializer):
    """Ligne de la liste de l'équipe (avec les annotations de `services.conversations_equipe`)."""

    def to_representation(self, conversation):
        client = conversation.client
        apercu = None
        if getattr(conversation, "apercu_role", None):
            apercu = {"texte": (conversation.apercu_texte or "")[:APERCU_CARACTERES],
                      "auteur_role": conversation.apercu_role,
                      "cree_le": serializers.DateTimeField().to_representation(conversation.apercu_date)}
        return {
            "id": conversation.pk,
            "client": {"id": client.pk, "nom_complet": client.nom_complet, "email": client.email,
                       "telephone": client.telephone, "langue": client.langue},
            "dernier_message": apercu,
            "non_lus": getattr(conversation, "non_lus", 0),
            "dernier_message_le": serializers.DateTimeField().to_representation(conversation.dernier_message_le)
            if conversation.dernier_message_le else None,
        }
