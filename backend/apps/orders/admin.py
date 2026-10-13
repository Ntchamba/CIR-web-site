from django.contrib import admin

from .models import Commande, HistoriqueStatut, LigneCommande, Proposition


class LigneInline(admin.TabularInline):
    model = LigneCommande
    extra = 0


class PropositionInline(admin.TabularInline):
    model = Proposition
    extra = 0


class HistoriqueInline(admin.TabularInline):
    model = HistoriqueStatut
    extra = 0
    readonly_fields = ["ancien", "nouveau", "par", "cree_le"]


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ["numero", "client", "type_batiment", "ville", "statut", "cree_le"]
    list_filter = ["statut", "type_batiment", "sur_mesure"]
    search_fields = ["numero", "client__nom_complet", "client__email"]
    inlines = [LigneInline, PropositionInline, HistoriqueInline]
