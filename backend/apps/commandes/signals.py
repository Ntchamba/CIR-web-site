"""Signaux de la négociation (règle 6 du contrat).

Le module `devis` s'y abonne (`apps/devis/signals.py`) ; `commandes` n'importe jamais `devis`.
Chaque signal reçoit `proposition` (l'instance de `Proposition` après son changement d'état).
"""
from django.dispatch import Signal

# Vague 3 : abonnés = `notifications` (qui prévient le client et l'équipe)
commande_creee = Signal()  # argument : commande
etape_changee = Signal()  # arguments : commande, de, vers, auteur
proposition_creee = Signal()  # argument : proposition (client ou équipe, devis envoyé compris)

proposition_acceptee = Signal()
proposition_refusee = Signal()
proposition_remplacee = Signal()
