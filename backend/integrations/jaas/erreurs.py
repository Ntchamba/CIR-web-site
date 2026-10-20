"""Erreurs de l'intégration JaaS (Jitsi as a Service)."""


class JaasErreur(Exception):
    """Erreur de base de l'intégration JaaS."""


class JaasNonConfigure(JaasErreur):
    """Les variables JAAS_APP_ID, JAAS_KEY_ID ou JAAS_PRIVATE_KEY manquent ou la clé est illisible."""


class JaasSalleInvalide(JaasErreur, ValueError):
    """Le nom de salle ne respecte pas le format autorisé."""
