"""Passe en « manqué » les appels restés sans réponse plus de 60 secondes.

    python manage.py expirer_appels

Lancée aussi à chaque tour de `envoyer_emails --boucle`.
"""
from django.core.management.base import BaseCommand

from apps.appels import services


class Command(BaseCommand):
    help = "Passe en « manqué » les appels sans réponse après 60 secondes."

    def handle(self, *args, **options):
        nombre = services.expirer_appels()
        self.stdout.write(f"{nombre} appel(s) mis à jour.")
