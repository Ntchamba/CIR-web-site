from django.apps import AppConfig


class MessagingConfig(AppConfig):
    """Messagerie instantanée entre les clients et l’équipe."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.messaging"
    verbose_name = "Messagerie instantanée entre les clients et l’équipe"
