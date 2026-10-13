from django.contrib import admin

from .models import DemandeContact


@admin.register(DemandeContact)
class DemandeContactAdmin(admin.ModelAdmin):
    list_display = ["nom", "objet", "type_batiment", "telephone", "traitee", "cree_le"]
    list_filter = ["objet", "traitee", "type_batiment"]
