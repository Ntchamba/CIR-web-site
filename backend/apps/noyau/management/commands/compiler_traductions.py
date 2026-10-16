"""Compile les traductions de l'API (locale/*/LC_MESSAGES/django.po → django.mo).

    python manage.py compiler_traductions             # compile, puis signale les messages non traduits
    python manage.py compiler_traductions --verifier  # vérifie seulement (code de sortie 1 en cas d'oubli)
"""
from django.core.management.base import BaseCommand, CommandError

from apps.noyau.catalogues import catalogues, ecarts, ecrire_mo, extraire_messages, lire_po


class Command(BaseCommand):
    help = "Compile les fichiers .po des messages de l'API et signale les messages non traduits."

    def add_arguments(self, parser):
        parser.add_argument("--verifier", action="store_true", help="Vérifier sans rien écrire.")

    def handle(self, *args, verifier=False, **options):
        if not verifier:
            for langue, po in catalogues().items():
                ecrire_mo(lire_po(po), po.with_suffix(".mo"))
                self.stdout.write(f"{langue} : {po.with_suffix('.mo')}")
        problemes = ecarts()
        for probleme in problemes:
            self.stderr.write(probleme)
        if problemes:
            raise CommandError(f"{len(problemes)} problème(s) de traduction.")
        self.stdout.write(self.style.SUCCESS(f"{len(extraire_messages())} messages traduits dans chaque langue."))
