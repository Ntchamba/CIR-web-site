from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Socle commun (pagination, permissions, limites, optimisation des images, données de démonstration)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Socle commun"
