"""Supprime les pièces jointes envoyées mais jamais rattachées à un message depuis plus de 24 heures.

    python manage.py purger_pieces_jointes

Lancée aussi à chaque tour de `envoyer_emails --boucle`.
"""
from django.core.management.base import BaseCommand

from apps.messagerie import pieces_jointes


class Command(BaseCommand):
    help = "Supprime les pièces jointes non rattachées depuis plus de 24 heures."

    def handle(self, *args, **options):
        self.stdout.write(f"{pieces_jointes.purger_non_rattachees()} pièce(s) jointe(s) supprimée(s).")
