"""Coordonnées initiales de l'accueil (contrat de la vague 1).

Les trois numéros de frontend/site/src/layout/coordonnees.js (validés par le propriétaire le 14 octobre 2026),
le WhatsApp et l'adresse du cahier des charges (« Coordonnées figurant au catalogue »). Les autres champs
restent vides : le site affiche ses textes par défaut tant que l'équipe n'a rien saisi.
"""
from django.db import migrations

TELEPHONES = ["+237 6 99 81 16 35", "+237 6 78 82 93 13", "+237 6 56 43 58 46"]
WHATSAPP = "+237 622 191 931"
ADRESSE = "Total Nkolmbong, Douala"


def creer_coordonnees(apps, schema_editor):
    ContenuAccueil = apps.get_model("contenus", "ContenuAccueil")
    contenu, _cree = ContenuAccueil.objects.get_or_create(pk=1)
    modifie = []
    if not contenu.telephones:
        contenu.telephones = TELEPHONES
        modifie.append("telephones")
    if not contenu.whatsapp:
        contenu.whatsapp = WHATSAPP
        modifie.append("whatsapp")
    if not contenu.adresse:
        contenu.adresse = ADRESSE
        modifie.append("adresse")
    if modifie:
        contenu.save(update_fields=modifie)


class Migration(migrations.Migration):
    dependencies = [("contenus", "0001_initial")]

    operations = [migrations.RunPython(creer_coordonnees, migrations.RunPython.noop)]
