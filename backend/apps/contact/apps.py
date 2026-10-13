from django.apps import AppConfig


class ContactConfig(AppConfig):
    """Contact et demandes de design sur mesure (BF-11)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.contact"
    verbose_name = "Contact et demandes de design sur mesure"
