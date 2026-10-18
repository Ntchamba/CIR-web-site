"""Administration Django (porte technique) du contact. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import DemandeContact


@admin.register(DemandeContact)
class DemandeContactAdmin(admin.ModelAdmin):
    list_display = ["reference", "nom", "type", "etat", "cree_le"]
    list_filter = ["etat", "type"]
    search_fields = ["reference", "nom", "email", "telephone"]
    readonly_fields = ["reference", "cree_le"]
    raw_id_fields = ["auteur", "produit"]
