from django.urls import path

from apps.core.a_venir import ModuleAVenir

urlpatterns = [
    path("", ModuleAVenir.as_view(module="paiements",
                                  description="Paiement par compte bancaire : bientôt disponible."),
         name="paiements"),
]
