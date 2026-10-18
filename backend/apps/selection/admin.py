"""Administration Django (porte technique) de la sélection."""
from django.contrib import admin

from .models import ElementSelection


@admin.register(ElementSelection)
class ElementSelectionAdmin(admin.ModelAdmin):
    list_display = ["utilisateur", "produit", "design", "cree_le"]
    raw_id_fields = ["utilisateur", "produit", "design"]
