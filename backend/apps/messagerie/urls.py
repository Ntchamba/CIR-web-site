from django.urls import path

from . import views

app_name = "messagerie"

urlpatterns = [
    path("conversation/", views.ConversationView.as_view(), name="conversation"),
    path("messages/", views.MessagesView.as_view(), name="messages"),
    path("pieces-jointes/", views.PiecesJointesView.as_view(), name="pieces-jointes"),
    path("pieces-jointes/<int:pk>/", views.PieceJointeView.as_view(), name="piece-jointe"),
    path("lu/", views.LuView.as_view(), name="lu"),
    path("non-lus/", views.NonLusView.as_view(), name="non-lus"),
]
