from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Comptes : inscription, connexion, adresse (BF-08) et gestion des utilisateurs (BF-17)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    verbose_name = "Comptes"
