from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
    verbose_name = "Notifications"

    def ready(self):
        from apps.noyau import direct

        from . import receivers  # noqa: F401 (abonne le module aux signaux des autres modules)
        from .services import compter_non_lues

        direct.enregistrer_compteur("notifications", compter_non_lues)
