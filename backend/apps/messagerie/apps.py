from django.apps import AppConfig


class MessagerieConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.messagerie"
    verbose_name = "Messagerie"

    def ready(self):
        from apps.noyau import direct

        from .services import compteur_non_lus

        direct.enregistrer_compteur("messagerie", compteur_non_lus)
