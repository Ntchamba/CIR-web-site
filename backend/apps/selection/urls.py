from django.urls import path

from .views import SelectionViewSet

app_name = "selection"

liste = SelectionViewSet.as_view({"get": "list", "post": "create", "delete": "vider"})
detail = SelectionViewSet.as_view({"delete": "destroy"})
resume = SelectionViewSet.as_view({"get": "resume"})

urlpatterns = [
    path("", liste, name="liste"),
    path("resume/", resume, name="resume"),
    path("<int:pk>/", detail, name="detail"),
]
