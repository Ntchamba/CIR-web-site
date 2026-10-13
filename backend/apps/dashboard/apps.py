from django.apps import AppConfig


class DashboardConfig(AppConfig):
    """Statistiques du tableau de bord."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard"
    verbose_name = "Statistiques du tableau de bord"
