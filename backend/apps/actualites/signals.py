"""Signaux des actualités (vague 3). `notifications` s'y abonne ; `actualites` n'importe jamais `notifications`.

`actualite_publiee(actualite)` : émis une seule fois, par la commande `notifier_actualites`, quand la nouveauté est
devenue visible (publiée et date de publication passée).
"""
from django.dispatch import Signal

actualite_publiee = Signal()
