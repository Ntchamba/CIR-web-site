"""Administration Django (porte technique) des contenus. L'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import Bandeau, ContenuAccueil, PhotoSphere


@admin.register(ContenuAccueil)
class ContenuAccueilAdmin(admin.ModelAdmin):
    list_display = ["__str__", "modifie_le"]

    def has_add_permission(self, request):
        return not ContenuAccueil.objects.exists()


@admin.register(Bandeau)
class BandeauAdmin(admin.ModelAdmin):
    list_display = ["texte", "actif", "debut", "fin", "ordre"]


@admin.register(PhotoSphere)
class PhotoSphereAdmin(admin.ModelAdmin):
    list_display = ["__str__", "produit", "ordre"]
