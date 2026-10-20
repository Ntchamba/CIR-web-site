from django.contrib import admin

from .models import Paiement


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ("reference", "commande", "client", "montant", "mode", "etat", "cree_le")
    list_filter = ("etat", "mode")
    search_fields = ("reference", "commande__reference", "client__email", "client__nom_complet")
    raw_id_fields = ("commande", "client", "saisi_par")
    # Un paiement ne se modifie jamais à la main : l'encaissement passe par services.py
    readonly_fields = [f.name for f in Paiement._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
