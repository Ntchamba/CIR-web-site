"""Fichiers de traduction des messages de l'API (backend/locale/<langue>/LC_MESSAGES/django.po).

Les messages sont écrits en français dans le code, entourés de gettext : `_("Le nom complet est obligatoire.")`.
Les fichiers .po donnent leur traduction ; les fichiers .mo (lus par Django) en sont la version compilée.

Ce module évite de dépendre des outils GNU gettext (makemessages, compilemessages), absents des images
Railway : `python manage.py compiler_traductions` compile les .po et signale les messages non traduits.
"""
import ast
import struct
from pathlib import Path

from django.conf import settings

FONCTIONS_GETTEXT = {"_", "gettext", "gettext_lazy"}
DOSSIERS_SOURCES = ("apps", "config")


def racine_backend():
    return Path(settings.BASE_DIR)


def fichiers_sources(racine=None):
    racine = Path(racine or racine_backend())
    for dossier in DOSSIERS_SOURCES:
        for chemin in sorted((racine / dossier).rglob("*.py")):
            parties = set(chemin.relative_to(racine).parts)
            if not parties & {"tests", "migrations"}:
                yield chemin


def extraire_messages(racine=None):
    """Messages à traduire trouvés dans le code : {message: [« fichier:ligne », …]}."""
    racine = Path(racine or racine_backend())
    messages = {}
    for chemin in fichiers_sources(racine):
        arbre = ast.parse(chemin.read_text(encoding="utf-8"), filename=str(chemin))
        for noeud in ast.walk(arbre):
            if (isinstance(noeud, ast.Call) and isinstance(noeud.func, ast.Name)
                    and noeud.func.id in FONCTIONS_GETTEXT and noeud.args
                    and isinstance(noeud.args[0], ast.Constant) and isinstance(noeud.args[0].value, str)):
                position = f"{chemin.relative_to(racine)}:{noeud.lineno}"
                messages.setdefault(noeud.args[0].value, []).append(position)
    return messages


# --- Lecture des .po ---

def _decoder(chaine):
    """Contenu d'une chaîne entre guillemets d'un fichier .po (échappements \\" \\\\ \\n \\t)."""
    return ast.literal_eval(chaine)


def lire_po(chemin):
    """Renvoie {msgid: msgstr} (l'en-tête, de msgid vide, est inclus)."""
    entrees, courant, cle = {}, {}, None

    def ranger():
        if "msgid" in courant:
            entrees[courant["msgid"]] = courant.get("msgstr", "")

    for ligne in Path(chemin).read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#"):
            continue
        if ligne.startswith("msgid "):
            ranger()
            courant, cle = {"msgid": _decoder(ligne[6:])}, "msgid"
        elif ligne.startswith("msgstr "):
            courant["msgstr"], cle = _decoder(ligne[7:]), "msgstr"
        elif ligne.startswith('"') and cle:
            courant[cle] += _decoder(ligne)
    ranger()
    return entrees


# --- Écriture des .mo (format GNU, lu par le module gettext de Python) ---

def ecrire_mo(entrees, chemin=None):
    """Compile {msgid: msgstr} au format .mo ; écrit le fichier si `chemin` est donné, renvoie les octets."""
    paires = sorted((k.encode("utf-8"), v.encode("utf-8")) for k, v in entrees.items() if v or k == "")
    nombre = len(paires)
    debut_originaux = 7 * 4
    debut_traductions = debut_originaux + nombre * 8
    debut_textes = debut_traductions + nombre * 8
    originaux, traductions, textes = [], [], b""
    for original, traduction in paires:
        originaux.append((len(original), debut_textes + len(textes)))
        textes += original + b"\0"
    for original, traduction in paires:
        traductions.append((len(traduction), debut_textes + len(textes)))
        textes += traduction + b"\0"
    octets = struct.pack("<7I", 0x950412DE, 0, nombre, debut_originaux, debut_traductions, 0, debut_textes)
    octets += b"".join(struct.pack("<2I", *p) for p in originaux)
    octets += b"".join(struct.pack("<2I", *p) for p in traductions)
    octets += textes
    if chemin:
        Path(chemin).write_bytes(octets)
    return octets


def catalogues(racine=None):
    """Fichiers .po du projet : {code de langue Django (dossier) : chemin}."""
    dossier = Path(racine or racine_backend()) / "locale"
    return {p.parent.parent.name: p for p in sorted(dossier.glob("*/LC_MESSAGES/django.po"))}


def ecarts(racine=None):
    """Problèmes de traduction : messages du code absents ou vides dans un .po, .mo absent ou périmé."""
    messages = extraire_messages(racine)
    problemes = []
    for langue, po in catalogues(racine).items():
        entrees = lire_po(po)
        for message in messages:
            if not entrees.get(message):
                problemes.append(f"{langue} : message non traduit : {message!r}")
        mo = po.with_suffix(".mo")
        if not mo.exists() or mo.read_bytes() != ecrire_mo(entrees):
            problemes.append(f"{langue} : {mo.name} à recompiler (python manage.py compiler_traductions)")
    return problemes
