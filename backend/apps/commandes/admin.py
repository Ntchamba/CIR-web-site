"""Administration Django (porte technique) des commandes. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import ChangementEtat, Commande, LigneCommande, Proposition


class LigneInline(admin.TabularInline):
    model = LigneCommande
    extra = 0
    raw_id_fields = ["produit", "design"]


class PropositionInline(admin.TabularInline):
    model = Proposition
    extra = 0
    raw_id_fields = ["auteur", "devis"]


class HistoriqueInline(admin.TabularInline):
    model = ChangementEtat
    extra = 0
    raw_id_fields = ["auteur"]


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ["reference", "client", "type_batiment", "etat", "surface_m2", "montant_convenu", "cree_le"]
    list_filter = ["etat", "type_batiment"]
    search_fields = ["reference", "client__nom_complet", "client__email"]
    readonly_fields = ["reference", "cree_le", "modifie_le"]
    raw_id_fields = ["client"]
    inlines = [LigneInline, PropositionInline, HistoriqueInline]
