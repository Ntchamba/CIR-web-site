"""Signaux de la négociation (règle 6 du contrat).

Le module `devis` s'y abonne (`apps/devis/signals.py`) ; `commandes` n'importe jamais `devis`.
Chaque signal reçoit `proposition` (l'instance de `Proposition` après son changement d'état).
"""
from django.dispatch import Signal

proposition_acceptee = Signal()
proposition_refusee = Signal()
proposition_remplacee = Signal()
