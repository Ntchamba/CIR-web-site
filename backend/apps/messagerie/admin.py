from django.contrib import admin

from .models import Conversation, Message, PieceJointe


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "dernier_message_le")
    search_fields = ("client__email", "client__nom_complet")
    raw_id_fields = ("client",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "auteur_role", "cree_le", "lu_le")
    list_filter = ("auteur_role",)
    raw_id_fields = ("conversation", "auteur", "commande")


@admin.register(PieceJointe)
class PieceJointeAdmin(admin.ModelAdmin):
    list_display = ("id", "nom_original", "type", "taille", "message", "cree_le")
    raw_id_fields = ("message", "proprietaire")
