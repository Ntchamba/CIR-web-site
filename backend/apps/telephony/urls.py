from django.urls import path

from apps.core.a_venir import ModuleAVenir

urlpatterns = [
    path("", ModuleAVenir.as_view(module="appels",
                                  description="Appels locaux (Orange, MTN) et internationaux : bientôt disponibles."),
         name="appels"),
]
