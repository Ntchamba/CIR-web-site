"""Erreurs de l'intégration Gmail. Aucun jeton ni secret dans les messages."""


class GmailErreur(Exception):
    """Erreur de base de l'intégration Gmail."""


class GmailNonConfigure(GmailErreur):
    """Les variables GMAIL_* nécessaires sont absentes."""


class GmailErreurTemporaire(GmailErreur):
    """Réseau, délai dépassé, 429 ou 5xx : on réessaiera plus tard."""


class GmailErreurDefinitive(GmailErreur):
    """400, 401/403 de configuration, adresse refusée : inutile de réessayer."""
