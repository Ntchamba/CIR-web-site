from django.db import migrations, models
from django.utils import timezone


def marquer_existantes(apps, schema_editor):
    """Les actualités déjà visibles avant cette version ne sont pas annoncées après coup."""
    Actualite = apps.get_model("actualites", "Actualite")
    maintenant = timezone.now()
    Actualite.objects.filter(publie=True, publie_le__lte=maintenant, notifiee_le__isnull=True).update(
        notifiee_le=maintenant)


class Migration(migrations.Migration):

    dependencies = [
        ("actualites", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="actualite",
            name="notifiee_le",
            field=models.DateTimeField(blank=True, editable=False, null=True, verbose_name="annoncée le"),
        ),
        migrations.RunPython(marquer_existantes, migrations.RunPython.noop),
    ]
