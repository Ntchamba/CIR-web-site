"""Rétention de l'assistant : conversations (ASSISTANT_RETENTION_JOURS), journal et brouillons traités (180 jours).

    python manage.py purger_assistant

Le programme d'envoi (`envoyer_emails --boucle`) l'appelle aussi, au plus une fois par heure.
"""
from django.core.management.base import BaseCommand

from apps.assistant import services


class Command(BaseCommand):
    help = "Supprime les conversations, lignes de journal et brouillons traités au-delà de leur durée de conservation."

    def handle(self, *args, **options):
        resultat = services.purger()
        self.stdout.write(f"{resultat['conversations']} suppression(s) de conversation, {resultat['journal']} de "
                          f"journal, {resultat['brouillons']} de brouillon.")
