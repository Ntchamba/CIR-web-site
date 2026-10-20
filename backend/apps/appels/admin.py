from django.contrib import admin

from .models import Appel


@admin.register(Appel)
class AppelAdmin(admin.ModelAdmin):
    list_display = ("reference", "client", "type", "etat", "repondu_par", "cree_le")
    list_filter = ("etat", "type")
    search_fields = ("reference", "client__email", "client__nom_complet")
    raw_id_fields = ("client", "repondu_par", "commande")
    readonly_fields = ("salle",)
