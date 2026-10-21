"""Erreurs de l'intégration Gemini. Aucune clé, aucun corps de réponse ni texte d'utilisateur dans les messages."""


class GeminiErreur(Exception):
    """Erreur de base de l'intégration Gemini."""


class GeminiNonConfigure(GeminiErreur):
    """La variable GEMINI_API_KEY est absente."""


class GeminiErreurTemporaire(GeminiErreur):
    """Réseau, délai dépassé, 429, 5xx ou réponse illisible : on réessaiera plus tard."""


class GeminiErreurDefinitive(GeminiErreur):
    """400, 401, 403 (clé ou requête refusée), modèle ou message invalide : inutile de réessayer."""


class GeminiContenuBloque(GeminiErreur):
    """Réponse bloquée par les réglages de sécurité de Gemini, ou aucune candidate."""
