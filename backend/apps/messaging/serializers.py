from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    de_l_equipe = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "conversation", "auteur", "auteur_nom", "de_l_equipe", "est_systeme", "texte",
                  "lu_par_client", "lu_par_equipe", "cree_le"]
        read_only_fields = ["conversation", "auteur", "est_systeme", "lu_par_client", "lu_par_equipe", "cree_le"]

    def get_auteur_nom(self, message):
        if message.est_systeme or not message.auteur:
            return "CIR"
        return "Équipe CIR" if message.auteur.is_staff else message.auteur.nom_complet

    def get_de_l_equipe(self, message):
        return bool(message.auteur and message.auteur.is_staff)

    def validate_texte(self, valeur):
        valeur = valeur.strip()
        if not valeur:
            raise serializers.ValidationError("Le message est vide.")
        return valeur


class ConversationSerializer(serializers.ModelSerializer):
    commande_numero = serializers.CharField(source="commande.numero", read_only=True, default=None)
    client_nom = serializers.CharField(source="client.nom_complet", read_only=True)
    dernier_message = serializers.SerializerMethodField()
    non_lus = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Conversation
        fields = ["id", "sujet", "commande", "commande_numero", "client", "client_nom", "dernier_message",
                  "non_lus", "cree_le", "modifie_le"]
        read_only_fields = ["commande", "client", "cree_le", "modifie_le"]

    def get_dernier_message(self, conversation):
        dernier = conversation.messages.order_by("-cree_le").first()
        return MessageSerializer(dernier).data if dernier else None
