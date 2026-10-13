from django.apps import AppConfig


class NewsConfig(AppConfig):
    """Nouveautés (BF-07)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.news"
    verbose_name = "Nouveautés"
