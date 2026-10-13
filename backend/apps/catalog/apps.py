from django.apps import AppConfig


class CatalogConfig(AppConfig):
    """Catalogue : familles, produits, prix, détails techniques (BF-01, BF-05, BF-06, BF-14)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.catalog"
    verbose_name = "Catalogue"
