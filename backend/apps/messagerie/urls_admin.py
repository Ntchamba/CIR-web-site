from django.urls import path

from . import views_admin as v

app_name = "messagerie_admin"

urlpatterns = [
    path("conversations/", v.ConversationsView.as_view(), name="conversations"),
    path("conversations/<int:pk>/messages/", v.MessagesEquipeView.as_view(), name="messages"),
    path("conversations/<int:pk>/lu/", v.LuEquipeView.as_view(), name="lu"),
    path("resume/", v.ResumeView.as_view(), name="resume"),
    path("pieces-jointes/", v.PiecesJointesEquipeView.as_view(), name="pieces-jointes"),
    path("pieces-jointes/<int:pk>/", v.PieceJointeEquipeView.as_view(), name="piece-jointe"),
]
