"""Point d'entrée unique des notifications.

MODULE À VENIR : envoi des e-mails par Gmail (confirmation d'inscription, nouvelle commande, nouvelle
proposition, changement d'étape, copie des messages du formulaire de contact à l'équipe).

En attendant, chaque événement est seulement écrit dans le journal du serveur. Le reste du code appelle
déjà notifier(...) aux bons endroits : brancher Gmail ne demandera de modifier que ce fichier.
"""
import logging

journal = logging.getLogger("cir.notifications")

EVENEMENTS = {
    "commande.nouvelle": "Nouvelle commande",
    "commande.proposition": "Nouvelle proposition de prix",
    "commande.statut": "La commande change d'étape",
    "contact.nouveau": "Nouveau message du formulaire de contact",
}


def notifier(evenement, destinataire, contexte):
    """destinataire : un utilisateur, ou None pour prévenir l'équipe du CIR."""
    qui = destinataire.email if destinataire else "équipe CIR"
    journal.info("[notification à venir] %s → %s", EVENEMENTS.get(evenement, evenement), qui)
