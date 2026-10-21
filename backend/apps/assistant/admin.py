"""Administration Django (porte technique) de l'assistant, en lecture seule : l'équipe utilise le tableau de bord."""
from django.contrib import admin

from .models import Brouillon, JournalAssistant


class LectureSeuleAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(JournalAssistant)
class JournalAdmin(LectureSeuleAdmin):
    list_display = ["cree_le", "agent", "resultat", "code", "jetons_entree", "jetons_sortie"]
    list_filter = ["agent", "resultat"]


@admin.register(Brouillon)
class BrouillonAdmin(LectureSeuleAdmin):
    list_display = ["id", "type", "etat", "bloque", "cree_le"]
    list_filter = ["type", "etat"]
