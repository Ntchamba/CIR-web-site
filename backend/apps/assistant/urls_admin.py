from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views_admin

app_name = "assistant_admin"

routeur = SimpleRouter()
routeur.register("brouillons", views_admin.BrouillonViewSet, basename="brouillons")
routeur.register("journal", views_admin.JournalViewSet, basename="journal")
routeur.register("conversations", views_admin.ConversationAdminViewSet, basename="conversations")

urlpatterns = [path("statut/", views_admin.StatutView.as_view(), name="statut")] + routeur.urls
