"""Administration Django (porte technique) des actualités. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import Actualite


@admin.register(Actualite)
class ActualiteAdmin(admin.ModelAdmin):
    list_display = ["titre", "publie", "publie_le", "produit"]
    list_filter = ["publie"]
    search_fields = ["titre"]
    readonly_fields = ["slug", "cree_le", "modifie_le"]
