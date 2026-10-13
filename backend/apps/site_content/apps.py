from django.apps import AppConfig


class SiteContentConfig(AppConfig):
    """Contenus du site : accueil, sphère de photos, coordonnées (BF-15)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.site_content"
    verbose_name = "Contenus du site"
