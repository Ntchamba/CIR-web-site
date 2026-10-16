"""Administration Django (porte technique) des utilisateurs."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm

from .models import Utilisateur


class FormulaireCreation(BaseUserCreationForm):
    class Meta:
        model = Utilisateur
        fields = ["email", "nom_complet", "role"]


class FormulaireModification(UserChangeForm):
    class Meta:
        model = Utilisateur
        fields = "__all__"


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    form = FormulaireModification
    add_form = FormulaireCreation
    ordering = ["-date_inscription"]
    list_display = ["email", "nom_complet", "role", "ville", "is_active", "date_inscription"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "nom_complet", "telephone", "ville"]
    readonly_fields = ["date_inscription", "last_login"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Identité", {"fields": ["nom_complet", "telephone", "role", "langue"]}),
        ("Adresse", {"fields": ["ville", "quartier", "rue_ou_repere"]}),
        ("Accès", {"fields": ["is_active"]}),
        ("Dates", {"fields": ["date_inscription", "last_login"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "nom_complet", "role", "password1", "password2"]}),
    ]
    filter_horizontal = []
