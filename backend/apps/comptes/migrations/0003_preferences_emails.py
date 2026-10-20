from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("comptes", "0002_langue_preferee"),
    ]

    operations = [
        migrations.AddField(
            model_name="utilisateur",
            name="recevoir_nouveautes",
            field=models.BooleanField(default=False, verbose_name="recevoir les nouveautés par e-mail"),
        ),
        migrations.AddField(
            model_name="utilisateur",
            name="email_equipe",
            field=models.BooleanField(default=True, verbose_name="e-mails de l'équipe"),
        ),
    ]
