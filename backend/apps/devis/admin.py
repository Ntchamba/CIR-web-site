"""Administration Django (porte technique) des devis. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import DemandeRendu, Devis, ImageDemande, LigneDevis


class LigneInline(admin.TabularInline):
    model = LigneDevis
    extra = 0
    raw_id_fields = ["produit"]


class ImageInline(admin.TabularInline):
    model = ImageDemande
    extra = 0


@admin.register(Devis)
class DevisAdmin(admin.ModelAdmin):
    list_display = ["reference", "commande", "etat", "validite_jours", "envoye_le", "cree_le"]
    list_filter = ["etat"]
    search_fields = ["reference", "commande__reference"]
    readonly_fields = ["reference", "cree_le", "modifie_le"]
    raw_id_fields = ["commande", "demande", "cree_par"]
    inlines = [LigneInline]


@admin.register(DemandeRendu)
class DemandeRenduAdmin(admin.ModelAdmin):
    list_display = ["reference", "client", "type_batiment", "etat", "cree_le"]
    list_filter = ["etat", "type_batiment"]
    search_fields = ["reference", "client__nom_complet", "client__email"]
    readonly_fields = ["reference", "cree_le", "modifie_le"]
    raw_id_fields = ["client", "produit", "commande"]
    inlines = [ImageInline]
