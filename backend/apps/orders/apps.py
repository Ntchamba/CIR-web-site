from django.apps import AppConfig


class OrdersConfig(AppConfig):
    """Commandes, négociation et suivi (BF-10, BF-12, BF-13, BF-16)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.orders"
    verbose_name = "Commandes, négociation et suivi"
