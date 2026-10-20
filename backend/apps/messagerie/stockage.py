"""Stockage PRIVÉ des pièces jointes : dossier `settings.PRIVATE_ROOT`, jamais servi par `/media/`.

Les fichiers ne sont lus que par la vue de téléchargement, qui vérifie les droits. Aucune adresse publique
(`base_url` est vide : `fichier.url` n'existe pas).
"""
import os

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class StockagePrive(FileSystemStorage):
    @property
    def base_location(self):
        return str(settings.PRIVATE_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def base_url(self):
        return None

    def url(self, name):
        raise ValueError("Les pièces jointes sont privées : elles n'ont pas d'adresse publique.")


def stockage_prive():
    """Fonction appelée par le champ `fichier` (le dossier est lu à chaque usage : réglage modifiable en test)."""
    return StockagePrive()
