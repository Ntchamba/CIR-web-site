"""Revérifie auprès de CamPay les paiements en attente (au plus un appel par paiement toutes les 5 secondes).

    python manage.py reverifier_paiements

Lancée aussi à chaque tour de `envoyer_emails --boucle`. Une panne de CamPay est journalisée, jamais fatale.
"""
from django.core.management.base import BaseCommand

from apps.paiements import services


class Command(BaseCommand):
    help = "Revérifie les paiements CamPay en attente (expiration comprise)."

    def handle(self, *args, **options):
        self.stdout.write(f"{services.reverifier_en_attente()} paiement(s) mis à jour.")
