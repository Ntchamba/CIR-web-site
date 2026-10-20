"""Signaux de la messagerie. `notifications` s'y abonne ; `messagerie` n'importe jamais `notifications`.

- `message_cree(message)` : nouveau message (client ou équipe) ;
- `messages_lus(conversation, role_lecteur)` : l'autre partie a lu des messages (`role_lecteur` : « client » ou
  « equipe ») : les notifications de messages correspondantes sont marquées comme lues.
"""
from django.dispatch import Signal

message_cree = Signal()
messages_lus = Signal()
