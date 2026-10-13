from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Adresse, User


class AdresseInline(admin.StackedInline):
    model = Adresse
    can_delete = False


@admin.register(User)
class UtilisateurAdmin(UserAdmin):
    ordering = ["-date_joined"]
    list_display = ["email", "nom_complet", "type_client", "is_staff", "is_active", "date_joined"]
    list_filter = ["is_staff", "is_active", "type_client"]
    search_fields = ["email", "nom_complet", "telephone"]
    inlines = [AdresseInline]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profil", {"fields": ("nom_complet", "telephone", "type_client")}),
        ("Droits", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "nom_complet", "password1", "password2")}),)
