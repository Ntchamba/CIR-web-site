"""Numéros de téléphone mobiles camerounais : normalisation et masquage."""
import re

_MOBILE = re.compile(r"^2376\d{8}$")
_SEPARATEURS = re.compile(r"[\s.\-()]")


class TelephoneInvalide(ValueError):
    """Le texte n'est pas un numéro mobile camerounais."""


def normaliser(texte) -> str:
    """Renvoie `237XXXXXXXXX` (12 chiffres) ou lève `TelephoneInvalide`."""
    if not isinstance(texte, str):
        raise TelephoneInvalide("Numéro de téléphone invalide.")
    brut = _SEPARATEURS.sub("", texte)
    if brut.startswith("+"):
        brut = brut[1:]
    elif brut.startswith("00"):
        brut = brut[2:]
    if not (brut.isascii() and brut.isdigit()):
        raise TelephoneInvalide("Numéro de téléphone invalide.")
    if len(brut) == 9 and brut.startswith("6"):
        brut = "237" + brut
    if not _MOBILE.match(brut):
        raise TelephoneInvalide("Numéro de téléphone invalide.")
    return brut


def masquer(numero) -> str:
    """`237699001122` devient `+237 6** ** ** 22` ; un numéro invalide est entièrement masqué."""
    try:
        n = normaliser(numero)
    except TelephoneInvalide:
        return "+237 ** ** ** **"
    return f"+237 {n[3]}** ** ** {n[-2:]}"
