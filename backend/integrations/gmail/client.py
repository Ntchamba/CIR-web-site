"""Client minimal de l'API Gmail : envoi d'un e-mail via OAuth2 (jeton de rafraîchissement).

Les secrets viennent des variables d'environnement ; ils n'apparaissent ni dans les
messages d'erreur ni dans les journaux.
"""
import base64
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path

import requests
from django.template import Context, Engine

from .erreurs import GmailErreurDefinitive, GmailErreurTemporaire, GmailNonConfigure

journal = logging.getLogger(__name__)

URL_JETON = "https://oauth2.googleapis.com/token"
URL_ENVOI = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
DELAI = 15
MARGE_EXPIRATION = 60
_VARIABLES = ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_EXPEDITEUR")

_cache = {"jeton": None, "expire": 0.0}
_verrou = threading.Lock()


@dataclass
class MessageEmail:
    destinataire: str
    sujet: str
    texte: str
    html: str = ""
    repondre_a: str = ""
    entetes: dict = field(default_factory=dict)
    nom_expediteur: str = "CIR"


def configure() -> bool:
    """Vrai si les quatre variables GMAIL_* sont présentes."""
    return all(os.environ.get(v, "").strip() for v in _VARIABLES)


def vider_cache():
    """Oublie le jeton d'accès gardé en mémoire (tests, changement de configuration)."""
    with _verrou:
        _cache["jeton"], _cache["expire"] = None, 0.0


def _propre(valeur, nom):
    """Refuse tout retour à la ligne ou caractère de contrôle (injection d'en-têtes)."""
    texte = str(valeur)
    if any(c in texte for c in "\r\n\x00"):
        raise GmailErreurDefinitive(f"Caractère interdit dans le champ « {nom} ».")
    return texte


def _jeton_acces() -> str:
    with _verrou:
        if _cache["jeton"] and time.time() < _cache["expire"] - MARGE_EXPIRATION:
            return _cache["jeton"]
    try:
        reponse = requests.post(URL_JETON, data={
            "client_id": os.environ["GMAIL_CLIENT_ID"],
            "client_secret": os.environ["GMAIL_CLIENT_SECRET"],
            "refresh_token": os.environ["GMAIL_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        }, timeout=DELAI)
    except requests.RequestException:
        raise GmailErreurTemporaire("Service Gmail injoignable (jeton d'accès).") from None
    if reponse.status_code == 429 or reponse.status_code >= 500:
        raise GmailErreurTemporaire(f"Service Gmail indisponible (jeton, code {reponse.status_code}).")
    if reponse.status_code != 200:
        raise GmailErreurDefinitive(
            f"Échange du jeton refusé (code {reponse.status_code}) : vérifier la configuration Gmail.")
    try:
        donnees = reponse.json()
        jeton = donnees["access_token"]
        duree = int(donnees.get("expires_in", 3600))
    except (ValueError, KeyError, TypeError):
        raise GmailErreurTemporaire("Réponse inattendue du service Gmail (jeton).") from None
    with _verrou:
        _cache["jeton"], _cache["expire"] = jeton, time.time() + duree
    return jeton


def construire_mime(message: MessageEmail) -> EmailMessage:
    """Construit le message MIME UTF-8 `multipart/alternative` (texte puis HTML)."""
    expediteur = os.environ.get("GMAIL_EXPEDITEUR", "")
    if not message.destinataire or "@" not in message.destinataire:
        raise GmailErreurDefinitive("Adresse du destinataire invalide.")
    msg = EmailMessage()
    msg["To"] = _propre(message.destinataire, "destinataire")
    msg["From"] = formataddr((_propre(message.nom_expediteur, "nom de l'expéditeur"),
                              _propre(expediteur, "expéditeur")), charset="utf-8")
    msg["Subject"] = _propre(message.sujet, "sujet")
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain=expediteur.rsplit("@", 1)[-1] or None)
    if message.repondre_a:
        msg["Reply-To"] = _propre(message.repondre_a, "répondre à")
    for nom, valeur in (message.entetes or {}).items():
        _propre(nom, "en-tête")
        msg[str(nom)] = _propre(valeur, f"en-tête {nom}")
    msg.set_content(message.texte or "", subtype="plain", charset="utf-8")
    if message.html:
        msg.add_alternative(message.html, subtype="html", charset="utf-8")
    return msg


def envoyer(message: MessageEmail) -> str:
    """Envoie l'e-mail et renvoie l'identifiant du message Gmail."""
    if not configure():
        raise GmailNonConfigure("L'envoi d'e-mails n'est pas configuré.")
    msg = construire_mime(message)
    brut = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    jeton = _jeton_acces()
    try:
        reponse = requests.post(URL_ENVOI, json={"raw": brut},
                                headers={"Authorization": f"Bearer {jeton}"}, timeout=DELAI)
    except requests.RequestException:
        raise GmailErreurTemporaire("Service Gmail injoignable (envoi).") from None
    code = reponse.status_code
    if code == 401:
        vider_cache()  # jeton périmé ou révoqué : le prochain essai en demandera un nouveau
        raise GmailErreurDefinitive("Accès Gmail refusé (code 401) : vérifier la configuration.")
    if code == 429 or code >= 500:
        raise GmailErreurTemporaire(f"Service Gmail indisponible (code {code}).")
    if code != 200:
        raise GmailErreurDefinitive(f"Envoi refusé par Gmail (code {code}).")
    try:
        return str(reponse.json()["id"])
    except (ValueError, KeyError, TypeError):
        raise GmailErreurTemporaire("Réponse inattendue du service Gmail (envoi).") from None


_moteur = None


def rendre_gabarit(**contexte) -> tuple:
    """Rend `gabarits/base.txt` et `base.html` ; renvoie (texte, html). Échappement automatique actif."""
    global _moteur
    if _moteur is None:
        _moteur = Engine(dirs=[str(Path(__file__).parent / "gabarits")], autoescape=True)
    defauts = {"titre": "", "corps_html": "", "corps_texte": "", "lien": "",
               "libelle_lien": "", "pied": "", "lien_desabonnement": ""}
    defauts.update(contexte)
    texte = _moteur.get_template("base.txt").render(Context(defauts, autoescape=False))
    html = _moteur.get_template("base.html").render(Context(defauts))
    return texte.strip() + "\n", html
