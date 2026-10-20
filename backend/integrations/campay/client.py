"""Client minimal de l'API CamPay : collecte mobile money, lien de paiement, statut d'une transaction.

Les secrets viennent des variables d'environnement ; ils n'apparaissent ni dans les
messages d'erreur ni dans les journaux (ni les numéros de téléphone complets).
"""
import logging
import os
import re
import threading
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import requests

from .erreurs import CampayErreurDefinitive, CampayErreurTemporaire, CampayNonConfigure
from .telephone import TelephoneInvalide, normaliser

journal = logging.getLogger(__name__)

BASE_DEFAUT = "https://www.campay.net/api"
DELAI = 15
MARGE_EXPIRATION = 60
DEVISE = "XAF"
_REFERENCE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_STATUTS = {"PENDING": "en_attente", "SUCCESSFUL": "reussi", "FAILED": "echoue"}

_cache = {"jeton": None, "expire": 0.0}
_verrou = threading.Lock()


@dataclass(frozen=True)
class Collecte:
    reference: str
    code_ussd: str = ""
    operateur: str = ""


@dataclass(frozen=True)
class Transaction:
    reference: str
    statut: str  # 'en_attente' | 'reussi' | 'echoue'
    montant: int
    devise: str
    operateur: str = ""
    reference_operateur: str = ""
    reference_externe: str = ""
    raison: str = ""


def configure() -> bool:
    """Vrai si CAMPAY_USERNAME et CAMPAY_PASSWORD sont présents."""
    return all(os.environ.get(v, "").strip() for v in ("CAMPAY_USERNAME", "CAMPAY_PASSWORD"))


def vider_cache():
    """Oublie le jeton d'accès gardé en mémoire (tests, changement de configuration)."""
    with _verrou:
        _cache["jeton"], _cache["expire"] = None, 0.0


def _base() -> str:
    return (os.environ.get("CAMPAY_BASE_URL", "").strip() or BASE_DEFAUT).rstrip("/")


def _json(reponse, contexte):
    try:
        donnees = reponse.json()
    except ValueError:
        donnees = None
    if not isinstance(donnees, dict):
        raise CampayErreurTemporaire(f"Réponse inattendue du service CamPay ({contexte}).")
    return donnees


def _erreur_http(code, contexte):
    """Convertit un code HTTP d'échec en erreur (sans jamais citer le corps de la réponse)."""
    if code == 429 or code >= 500:
        raise CampayErreurTemporaire(f"Service CamPay indisponible ({contexte}, code {code}).")
    if code in (401, 403):
        raise CampayErreurDefinitive(f"Accès CamPay refusé ({contexte}, code {code}).", "refuse")
    if code == 404:
        raise CampayErreurDefinitive(f"Ressource CamPay introuvable ({contexte}).", "inconnue")
    raise CampayErreurDefinitive(f"Requête refusée par CamPay ({contexte}, code {code}).", "inconnue")


def _jeton_acces() -> str:
    with _verrou:
        if _cache["jeton"] and time.time() < _cache["expire"] - MARGE_EXPIRATION:
            return _cache["jeton"]
    try:
        reponse = requests.post(f"{_base()}/token/", json={
            "username": os.environ["CAMPAY_USERNAME"],
            "password": os.environ["CAMPAY_PASSWORD"],
        }, timeout=DELAI)
    except requests.RequestException:
        raise CampayErreurTemporaire("Service CamPay injoignable (jeton d'accès).") from None
    if reponse.status_code != 200:
        if reponse.status_code in (400, 401, 403):
            raise CampayErreurDefinitive(
                f"Identifiants CamPay refusés (code {reponse.status_code}) : vérifier la configuration.",
                "refuse")
        _erreur_http(reponse.status_code, "jeton")
    donnees = _json(reponse, "jeton")
    try:
        jeton = str(donnees["token"])
        duree = int(donnees.get("expires_in", 3600))
    except (KeyError, TypeError, ValueError):
        raise CampayErreurTemporaire("Réponse inattendue du service CamPay (jeton).") from None
    if not jeton:
        raise CampayErreurTemporaire("Réponse inattendue du service CamPay (jeton).")
    with _verrou:
        _cache["jeton"], _cache["expire"] = jeton, time.time() + duree
    return jeton


def _appeler(methode, chemin, contexte, corps=None):
    """Appel authentifié ; un 401 vide le cache du jeton et refait un seul essai."""
    if not configure():
        raise CampayNonConfigure("Le paiement CamPay n'est pas configuré.")
    for essai in (1, 2):
        jeton = _jeton_acces()
        try:
            fonction = requests.post if methode == "POST" else requests.get
            options = {"json": corps} if methode == "POST" else {}
            reponse = fonction(f"{_base()}{chemin}", headers={"Authorization": f"Token {jeton}"},
                               timeout=DELAI, **options)
        except requests.RequestException:
            raise CampayErreurTemporaire(f"Service CamPay injoignable ({contexte}).") from None
        if reponse.status_code == 401 and essai == 1:
            vider_cache()
            continue
        return reponse


def _texte_erreur(reponse) -> str:
    """Texte d'erreur de CamPay en minuscules, utilisé seulement pour classer l'échec (jamais affiché)."""
    try:
        return str(reponse.json()).lower()
    except ValueError:
        return ""


def _verifier_montant(montant) -> int:
    if isinstance(montant, bool) or not isinstance(montant, int) or montant <= 0:
        raise CampayErreurDefinitive("Montant invalide : un entier positif en FCFA est attendu.",
                                     "montant_invalide")
    return montant


def _verifier_reference_externe(valeur) -> str:
    if not isinstance(valeur, str) or not _REFERENCE.match(valeur):
        raise CampayErreurDefinitive("Référence externe invalide.", "inconnue")
    return valeur


def _description(texte) -> str:
    propre = "".join(c if c.isprintable() else " " for c in str(texte or "")).strip()
    return propre[:200] or "Paiement CIR"


def initier_collecte(*, montant, telephone, description, reference_externe) -> Collecte:
    """Demande au client de valider le paiement sur son téléphone (MTN ou Orange Money)."""
    montant = _verifier_montant(montant)
    reference_externe = _verifier_reference_externe(reference_externe)
    try:
        numero = normaliser(telephone)
    except TelephoneInvalide:
        raise CampayErreurDefinitive("Numéro de téléphone invalide.", "numero_invalide") from None
    reponse = _appeler("POST", "/collect/", "collecte", {
        "amount": str(montant), "currency": DEVISE, "from": numero,
        "description": _description(description), "external_reference": reference_externe,
    })
    if reponse.status_code != 200:
        if reponse.status_code == 400:
            texte = _texte_erreur(reponse)
            if any(m in texte for m in ("phone", "number", "from", "msisdn", "operator")):
                raise CampayErreurDefinitive("Numéro refusé par CamPay.", "numero_invalide")
            if "amount" in texte:
                raise CampayErreurDefinitive("Montant refusé par CamPay.", "montant_invalide")
            raise CampayErreurDefinitive("Collecte refusée par CamPay (code 400).", "refuse")
        _erreur_http(reponse.status_code, "collecte")
    donnees = _json(reponse, "collecte")
    reference = donnees.get("reference")
    if not isinstance(reference, str) or not reference:
        raise CampayErreurTemporaire("Réponse inattendue du service CamPay (collecte).")
    return Collecte(reference=reference, code_ussd=str(donnees.get("ussd_code") or ""),
                    operateur=str(donnees.get("operator") or ""))


def _adresse_retour_valide(url) -> bool:
    if not isinstance(url, str) or any(c.isspace() for c in url):
        return False
    analyse = urlparse(url)
    if analyse.scheme == "https":
        return bool(analyse.hostname)
    return analyse.scheme == "http" and analyse.hostname == "localhost"


def lien_paiement(*, montant, description, reference_externe, url_retour, url_echec) -> str:
    """Renvoie l'adresse de paiement CamPay (carte ou mobile money)."""
    montant = _verifier_montant(montant)
    reference_externe = _verifier_reference_externe(reference_externe)
    for url in (url_retour, url_echec):
        if not _adresse_retour_valide(url):
            raise CampayErreurDefinitive("Adresse de retour refusée : https:// exigé.", "inconnue")
    reponse = _appeler("POST", "/get_payment_link/", "lien de paiement", {
        "amount": str(montant), "currency": DEVISE, "description": _description(description),
        "external_reference": reference_externe,
        "redirect_url": url_retour, "failure_redirect_url": url_echec,
    })
    if reponse.status_code != 200:
        if reponse.status_code == 400:
            raise CampayErreurDefinitive("Lien de paiement refusé par CamPay (code 400).", "refuse")
        _erreur_http(reponse.status_code, "lien de paiement")
    lien = _json(reponse, "lien de paiement").get("link")
    if not isinstance(lien, str) or not lien.startswith("https://"):
        raise CampayErreurTemporaire("Réponse inattendue du service CamPay (lien de paiement).")
    return lien


def _montant_entier(valeur) -> int:
    try:
        d = Decimal(str(valeur))
    except InvalidOperation:
        raise CampayErreurTemporaire("Montant illisible dans la réponse CamPay.") from None
    if not d.is_finite() or d != d.to_integral_value() or d < 0:
        raise CampayErreurTemporaire("Montant illisible dans la réponse CamPay.")
    return int(d)


def statut(reference) -> Transaction:
    """Interroge CamPay sur une transaction. Un statut inconnu vaut `en_attente`, jamais `reussi`."""
    if not isinstance(reference, str) or not _REFERENCE.match(reference):
        raise CampayErreurDefinitive("Référence de transaction invalide.", "inconnue")
    reponse = _appeler("GET", f"/transaction/{reference}/", "statut")
    if reponse.status_code != 200:
        _erreur_http(reponse.status_code, "statut")
    donnees = _json(reponse, "statut")
    brut = str(donnees.get("status") or "").strip().upper()
    return Transaction(
        reference=str(donnees.get("reference") or reference),
        statut=_STATUTS.get(brut, "en_attente"),
        montant=_montant_entier(donnees.get("amount", 0)),
        devise=str(donnees.get("currency") or "").upper(),
        operateur=str(donnees.get("operator") or ""),
        reference_operateur=str(donnees.get("operator_reference") or ""),
        reference_externe=str(donnees.get("external_reference") or ""),
        raison=str(donnees.get("reason") or ""),
    )
