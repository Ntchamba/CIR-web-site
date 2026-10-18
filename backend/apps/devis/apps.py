from django.apps import AppConfig


class DevisConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.devis"
    verbose_name = "Devis"

    def ready(self):
        from apps.commandes import extensions

        from . import signals  # noqa: F401 (branche les réactions aux signaux de la négociation)
        from .services import resume_pour_commande

        extensions.enregistrer_fournisseur_devis(resume_pour_commande)
