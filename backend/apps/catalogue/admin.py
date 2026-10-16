"""Administration Django (porte technique) du catalogue. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import Caracteristique, Couche, Design, Famille, ImageProduit, Produit


@admin.register(Famille)
class FamilleAdmin(admin.ModelAdmin):
    list_display = ["nom", "slug", "ordre"]
    readonly_fields = ["slug"]


class ImageInline(admin.TabularInline):
    model = ImageProduit
    extra = 0


class DesignInline(admin.TabularInline):
    model = Design
    extra = 0


class CaracteristiqueInline(admin.TabularInline):
    model = Caracteristique
    extra = 0


class CoucheInline(admin.TabularInline):
    model = Couche
    extra = 0


@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ["reference", "nom", "famille", "prix", "unite_prix", "en_ligne", "a_la_une"]
    list_filter = ["famille", "en_ligne", "a_la_une", "est_nouveau"]
    search_fields = ["reference", "nom"]
    readonly_fields = ["slug", "cree_le", "modifie_le"]
    inlines = [ImageInline, DesignInline, CaracteristiqueInline, CoucheInline]
