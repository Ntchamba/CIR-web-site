"""Signaux du contact (vague 3). `notifications` s'y abonne ; `contact` n'importe jamais `notifications`.

- `demande_contact_creee(demande)` : dépôt d'une demande ;
- `demande_contact_repondue(demande)` : l'équipe a répondu ou a traité la demande.
"""
from django.dispatch import Signal

demande_contact_creee = Signal()
demande_contact_repondue = Signal()
