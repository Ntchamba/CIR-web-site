"""Signaux des appels. `notifications` s'y abonne ; `appels` n'importe jamais `notifications`.

`appel_manque(appel)` : personne de l'équipe n'a répondu dans les 60 secondes.
"""
from django.dispatch import Signal

appel_manque = Signal()
