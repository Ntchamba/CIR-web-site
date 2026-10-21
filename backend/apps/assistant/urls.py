from django.urls import path

from . import views

app_name = "assistant"

urlpatterns = [
    path("disponibilite/", views.DisponibiliteView.as_view(), name="disponibilite"),
    path("messages/", views.MessagesView.as_view(), name="messages"),
    path("messages/<int:pk>/avis/", views.AvisView.as_view(), name="avis"),
    path("conversations/<uuid:cle>/", views.ConversationView.as_view(), name="conversation"),
]
