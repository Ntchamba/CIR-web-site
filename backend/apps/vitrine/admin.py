"""Administration Django (porte technique) de la vitrine. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import Demo, Realisation, Temoignage


@admin.register(Realisation)
class RealisationAdmin(admin.ModelAdmin):
    list_display = ["titre", "type_chantier", "ville", "publie", "date"]
    list_filter = ["type_chantier", "publie"]
    readonly_fields = ["slug", "cree_le"]
    filter_horizontal = ["produits"]


@admin.register(Demo)
class DemoAdmin(admin.ModelAdmin):
    list_display = ["titre", "duree", "publie"]
    list_filter = ["publie"]


@admin.register(Temoignage)
class TemoignageAdmin(admin.ModelAdmin):
    list_display = ["nom_affiche", "note", "langue", "statut", "cree_le"]
    list_filter = ["statut", "langue"]
    readonly_fields = ["auteur", "cree_le", "modere_le", "modere_par"]
