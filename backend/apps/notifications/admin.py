from django.contrib import admin

from .models import EnvoiEmail, ModeleEmail, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "utilisateur", "type", "lue", "cree_le")
    list_filter = ("type", "lue")
    raw_id_fields = ("utilisateur",)


@admin.register(EnvoiEmail)
class EnvoiEmailAdmin(admin.ModelAdmin):
    list_display = ("id", "destinataire_email", "evenement", "etat", "tentatives", "cree_le", "envoye_le")
    list_filter = ("etat", "evenement")
    readonly_fields = ("cle_unique", "corps_texte", "corps_html", "entetes", "message_id")


@admin.register(ModeleEmail)
class ModeleEmailAdmin(admin.ModelAdmin):
    list_display = ("evenement", "langue", "sujet")
    list_filter = ("langue",)
