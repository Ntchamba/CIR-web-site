from django.apps import AppConfig


class ShowcaseConfig(AppConfig):
    """Vitrine : réalisations, démonstrations, témoignages (BF-02, BF-03, BF-04)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.showcase"
    verbose_name = "Vitrine"
