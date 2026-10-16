"""Liens de vidéos YouTube ou Vimeo : adresse d'intégration (iframe) sans cookies de suivi si possible."""
import re
from urllib.parse import parse_qs, urlparse

_ID_YOUTUBE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_ID_VIMEO = re.compile(r"^\d{4,12}$")
HOTES_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com",
                 "www.youtube-nocookie.com"}
HOTES_VIMEO = {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}


def adresse_integration(lien):
    """Adresse à placer dans une iframe : youtube-nocookie.com/embed/… ou player.vimeo.com/video/….

    Renvoie None si le lien n'est ni une vidéo YouTube ni une vidéo Vimeo reconnue.
    """
    if not lien:
        return None
    adresse = urlparse(str(lien).strip())
    if adresse.scheme not in ("http", "https"):
        return None
    hote = (adresse.hostname or "").lower()
    morceaux = [m for m in adresse.path.split("/") if m]
    identifiant = None
    if hote in HOTES_YOUTUBE:
        if morceaux[:1] == ["watch"]:
            identifiant = (parse_qs(adresse.query).get("v") or [None])[0]
        elif len(morceaux) >= 2 and morceaux[0] in ("embed", "shorts", "live", "v"):
            identifiant = morceaux[1]
        if identifiant and _ID_YOUTUBE.match(identifiant):
            return f"https://www.youtube-nocookie.com/embed/{identifiant}"
        return None
    if hote == "youtu.be":
        identifiant = morceaux[0] if morceaux else None
        return f"https://www.youtube-nocookie.com/embed/{identifiant}" if identifiant and _ID_YOUTUBE.match(
            identifiant) else None
    if hote in HOTES_VIMEO:
        numeros = [m for m in morceaux if _ID_VIMEO.match(m)]
        return f"https://player.vimeo.com/video/{numeros[-1]}" if numeros else None
    return None
