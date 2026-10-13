from django.contrib import admin

from .models import Caracteristique, Couche, Famille, ImageProduit, Produit


class ImageInline(admin.TabularInline):
    model = ImageProduit
    extra = 0


class CaracteristiqueInline(admin.TabularInline):
    model = Caracteristique
    extra = 0


class CoucheInline(admin.TabularInline):
    model = Couche
    extra = 0


@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ["nom", "reference", "famille", "prix", "en_ligne", "a_la_une", "est_nouveau"]
    list_filter = ["famille", "en_ligne", "a_la_une", "est_nouveau"]
    search_fields = ["nom", "reference"]
    inlines = [ImageInline, CaracteristiqueInline, CoucheInline]


admin.site.register(Famille)
