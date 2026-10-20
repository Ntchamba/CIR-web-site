"""Signaux des paiements. `notifications` s'y abonne ; `paiements` n'importe jamais `notifications`.

Chaque signal reçoit `paiement` (instance de `Paiement` dont `commande` est à jour : montant payé compris).
Ils sont émis une seule fois par changement d'état, dans la transaction qui l'enregistre.
"""
from django.dispatch import Signal

paiement_reussi = Signal()  # encaissé (en ligne, après revérification, ou règlement hors ligne)
paiement_echoue = Signal()  # échoué ou expiré : le client est prévenu
paiement_anomalie = Signal()  # montant ou référence différents, ou reste à payer dépassé : l'équipe est prévenue
