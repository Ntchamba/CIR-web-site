from django.contrib import admin

from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ["auteur", "texte", "cree_le"]


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["__str__", "client", "commande", "modifie_le"]
    inlines = [MessageInline]
