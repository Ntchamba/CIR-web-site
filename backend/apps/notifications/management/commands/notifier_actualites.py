"""Annonce les actualités devenues visibles (une seule fois chacune) : notifications et e-mails des nouveautés.

    python manage.py notifier_actualites

Lancée aussi à chaque tour de `envoyer_emails --boucle`.
"""
from django.core.management.base import BaseCommand

from apps.notifications import taches


class Command(BaseCommand):
    help = "Annonce aux clients les actualités publiées et visibles qui ne l'ont pas encore été."

    def handle(self, *args, **options):
        self.stdout.write(f"{taches.notifier_actualites()} actualité(s) annoncée(s).")
