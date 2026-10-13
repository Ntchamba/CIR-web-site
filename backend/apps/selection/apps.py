from django.apps import AppConfig


class SelectionConfig(AppConfig):
    """Sélection de produits et de designs (BF-09)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.selection"
    verbose_name = "Sélection de produits et de designs"
