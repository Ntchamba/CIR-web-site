from django.contrib import admin

from .models import Demo, PhotoRealisation, Realisation, Temoignage


class PhotoInline(admin.TabularInline):
    model = PhotoRealisation
    extra = 0


@admin.register(Realisation)
class RealisationAdmin(admin.ModelAdmin):
    list_display = ["titre", "type_chantier", "ville", "publie", "date"]
    list_filter = ["type_chantier", "publie"]
    inlines = [PhotoInline]


@admin.register(Temoignage)
class TemoignageAdmin(admin.ModelAdmin):
    list_display = ["nom_client", "type_batiment", "ville", "note", "statut", "cree_le"]
    list_filter = ["statut", "type_batiment"]


admin.site.register(Demo)
