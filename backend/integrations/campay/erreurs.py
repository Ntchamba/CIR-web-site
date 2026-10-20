"""Erreurs de l'intégration CamPay. Aucune clé, aucun jeton ni numéro complet dans les messages."""


class CampayErreur(Exception):
    """Erreur de base de l'intégration CamPay."""


class CampayNonConfigure(CampayErreur):
    """CAMPAY_USERNAME ou CAMPAY_PASSWORD sont absents."""


class CampayErreurTemporaire(CampayErreur):
    """Réseau, délai dépassé, 429, 5xx ou réponse illisible : on réessaiera plus tard."""


class CampayErreurDefinitive(CampayErreur):
    """400, 401/403, numéro ou montant refusé : inutile de réessayer.

    `code` vaut `numero_invalide`, `montant_invalide`, `refuse` ou `inconnue`.
    """

    CODES = ("numero_invalide", "montant_invalide", "refuse", "inconnue")

    def __init__(self, message, code="inconnue"):
        super().__init__(message)
        self.code = code if code in self.CODES else "inconnue"
