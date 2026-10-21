"""Orchestrateur : un tour de conversation avec Gemini, outils en lecture seule et garde-fous de sortie.

Tour : historique réduit (12 messages) → appel du modèle avec les outils → pour chaque demande d'outil, nom contrôlé
contre la liste déclarée pour ce tour, arguments validés (schéma strict), exécution dans le contexte de l'utilisateur
→ au plus 4 tours d'outils, puis réponse finale imposée (sans outil) → contrôle de sortie. Délai total 45 s,
aucune réponse partielle, aucune nouvelle tentative (une erreur temporaire remonte telle quelle).

Vie privée : la requête envoyée à Gemini contient les consignes, la langue, l'indication « client connecté oui/non »,
l'historique de la conversation et les résultats des outils. Jamais nom, e-mail, téléphone ni adresse d'un compte.
"""
import functools
import logging
import time
from dataclasses import dataclass, field
from datetime import date

from django.conf import settings

from integrations.gemini import client as gemini
from integrations.gemini.erreurs import GeminiContenuBloque, GeminiErreurTemporaire

from . import garde_fous, outils
from .garde_fous import CONTENU, Coordonnees

journal = logging.getLogger("cir.assistant")

DELAI_TOTAL = 45
DELAI_APPEL = 30
TOURS_OUTILS_MAX = 4
APPELS_PAR_TOUR_MAX = 4
HISTORIQUE_MAX = 12
NOMS_LANGUES = {"fr": "français", "en": "anglais", "zh": "chinois simplifié", "de": "allemand", "ja": "japonais"}


# --- Prompts et connaissances -----------------------------------------------------------------------------

def dossier_agents():
    return settings.ASSISTANT_AGENTS_DIR


@functools.lru_cache(maxsize=8)
def _lire(chemin, mtime):
    return chemin.read_text(encoding="utf-8")


def lire_prompt(nom):
    """Contenu de `agents/prompts/<nom>.md` ; chaîne vide si le fichier est absent."""
    chemin = dossier_agents() / "prompts" / f"{nom}.md"
    try:
        return _lire(chemin, chemin.stat().st_mtime_ns)
    except OSError:
        return ""


def lire_connaissances():
    """Fiches de `agents/connaissances/` (hors README) : seule source de vérité, avec les outils."""
    dossier = dossier_agents() / "connaissances"
    fiches = []
    try:
        for chemin in sorted(dossier.glob("*.md")):
            if chemin.name.lower() != "readme.md":
                fiches.append(_lire(chemin, chemin.stat().st_mtime_ns).strip())
    except OSError:
        return ""
    return "\n\n".join(f for f in fiches if f)


def prompts_disponibles():
    return bool(lire_prompt("conseiller").strip() and lire_prompt("fond").strip())


def configure():
    """Vrai si la clé Gemini et les prompts sont présents."""
    return gemini.configure() and prompts_disponibles()


# --- Suivi d'un tour (journal) ----------------------------------------------------------------------------

@dataclass
class Suivi:
    """Ce qu'il faut journaliser, rempli au fil du tour (même en cas d'erreur)."""

    entrees: list = field(default_factory=list)  # une par appel à Gemini
    outils_appeles: list = field(default_factory=list)
    resultats: list = field(default_factory=list)  # résultats d'outils du tour (montants et liens autorisés)

    def jetons(self):
        return (sum(e["jetons_entree"] for e in self.entrees), sum(e["jetons_sortie"] for e in self.entrees))


@dataclass
class Tour:
    texte: str
    liens: list
    bloque: str
    proposer_contact: bool
    outils: list
    jetons_entree: int
    jetons_sortie: int
    duree_ms: int


def _instruction(agent, langue, utilisateur_connecte, indice=""):
    parties = [lire_prompt(agent).strip()]
    if agent == "conseiller":
        connaissances = lire_connaissances()
        if connaissances:
            parties.append("# Connaissances\n\n" + connaissances)
    parties.append(f"# Contexte de cet échange\n\nLangue de l'interface du client : {NOMS_LANGUES.get(langue, 'français')} "
                   f"({langue}). Date du jour : {date.today().isoformat()}.\n"
                   f"Client connecté : {'oui' if utilisateur_connecte else 'non'}.")
    if indice:
        parties.append(indice)
    return "\n\n".join(parties)


def indice_contexte(contexte):
    """Phrase d'indice sur la page consultée. Simple indice : l'outil vérifie, la référence n'est jamais crue."""
    if not isinstance(contexte, dict):
        return ""
    type_ = contexte.get("type")
    reference = " ".join(str(contexte.get("reference") or "").split())[:40]
    if type_ == "produit" and reference:
        return (f"Le client consulte la fiche du produit de référence « {reference} » (indice à vérifier avec "
                f"l'outil fiche_produit).")
    if type_ == "commande" and reference:
        return (f"Le client consulte le détail de la commande de référence « {reference} » (indice à vérifier avec "
                f"l'outil ma_commande).")
    return ""


# --- Boucle d'appels --------------------------------------------------------------------------------------

def _appeler(*, suivi, agent, utilisateur, modele, instruction, messages, noms_outils, temperature, jetons_max,
             debut, final):
    restant = DELAI_TOTAL - (time.monotonic() - debut)
    if restant < 2:
        raise GeminiErreurTemporaire("Délai total dépassé.")
    declarations = [] if final else outils.declarations(noms_outils)
    commence = time.monotonic()
    entree = {"agent": agent, "utilisateur": utilisateur, "modele": modele, "outils": [], "resultat": "ok",
              "code": "", "jetons_entree": 0, "jetons_sortie": 0, "duree_ms": 0}
    suivi.entrees.append(entree)
    try:
        reponse = gemini.generer(modele=modele, instruction=instruction, messages=messages, outils=declarations,
                                 temperature=temperature, jetons_max=jetons_max,
                                 delai=max(1, min(DELAI_APPEL, restant)))
    except GeminiContenuBloque:
        entree.update(resultat="bloque", code=CONTENU)
        raise
    except GeminiErreurTemporaire:
        entree.update(resultat="erreur_temporaire")
        raise
    except Exception as erreur:  # noqa: BLE001 - jamais le message (il pourrait citer une requête)
        entree.update(resultat="erreur", code=type(erreur).__name__[:40])
        raise
    finally:
        entree["duree_ms"] = int((time.monotonic() - commence) * 1000)
    entree.update(jetons_entree=reponse.jetons_entree, jetons_sortie=reponse.jetons_sortie,
                  outils=[a.nom for a in reponse.appels])
    return reponse


def executer_boucle(*, agent, modele, instruction, messages, noms_outils, contexte, suivi, utilisateur=None,
                    temperature=0.2, jetons_max=800):
    """Appelle le modèle jusqu'à une réponse texte. Renvoie la dernière `Reponse` (texte final)."""
    debut = time.monotonic()
    messages = list(messages)
    tours = 0
    while True:
        final = tours >= TOURS_OUTILS_MAX
        reponse = _appeler(suivi=suivi, agent=agent, utilisateur=utilisateur, modele=modele,
                           instruction=instruction, messages=messages, noms_outils=noms_outils,
                           temperature=temperature, jetons_max=jetons_max, debut=debut, final=final)
        if final or not reponse.appels:
            return reponse
        tours += 1
        for appel in reponse.appels[:APPELS_PAR_TOUR_MAX]:
            arguments = appel.arguments if isinstance(appel.arguments, dict) else {}
            resultat = outils.executer(appel.nom, arguments, contexte, noms_outils)
            suivi.outils_appeles.append(appel.nom if isinstance(appel.nom, str) else "?")
            suivi.resultats.append(resultat)
            messages.append({"role": "model", "appel": {"nom": appel.nom, "arguments": arguments}})
            messages.append({"role": "function", "resultat": {"nom": appel.nom, "contenu": resultat}})


def controler(texte, *, langue, suivi, extra_montants=()):
    """Contrôle de sortie d'après les résultats d'outils du tour."""
    montants = set(extra_montants)
    liens = []
    for resultat in suivi.resultats:
        montants |= outils.montants_de(resultat)
        liens.extend(outils.liens_de(resultat))
    return garde_fous.controler_sortie(texte, langue=langue, montants_autorises=montants, liens_autorises=liens,
                                       coordonnees=outils.coordonnees_publiques())


def historique(messages_db):
    """Derniers messages (12 au plus) au format du client Gemini ; commence toujours par un message du client."""
    recents = list(messages_db)[-HISTORIQUE_MAX:]
    messages = [{"role": "user" if m.role == "utilisateur" else "model", "texte": m.texte} for m in recents]
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    return messages


def tour_conseiller(*, texte, messages_precedents, langue, utilisateur, contexte_page, suivi):
    """Un tour du conseiller. Lève les erreurs Gemini (le service décide de la réponse HTTP)."""
    debut = time.monotonic()
    contexte = outils.Contexte(utilisateur=utilisateur, langue=langue)
    connecte = contexte.client is not None
    instruction = _instruction("conseiller", langue, connecte, indice_contexte(contexte_page))
    messages = historique(messages_precedents) + [{"role": "user", "texte": texte}]
    modele = settings.GEMINI_MODELE_ASSISTANT
    try:
        reponse = executer_boucle(agent="conseiller", modele=modele, instruction=instruction, messages=messages,
                                  noms_outils=outils.OUTILS_CONSEILLER, contexte=contexte, suivi=suivi,
                                  utilisateur=utilisateur if connecte else None)
        sortie = controler(reponse.texte, langue=langue, suivi=suivi) if (reponse.texte or "").strip() \
            else garde_fous.Sortie(garde_fous.texte_repli(CONTENU, langue), [], CONTENU, True)
    except GeminiContenuBloque:
        sortie = garde_fous.Sortie(garde_fous.texte_repli(CONTENU, langue), [], CONTENU, True)
    if sortie.bloque in (garde_fous.PRIX, garde_fous.ENGAGEMENT, CONTENU) and suivi.entrees:
        derniere = suivi.entrees[-1]
        if derniere["resultat"] == "ok":
            derniere.update(resultat="bloque", code=sortie.bloque)
    jetons_in, jetons_out = suivi.jetons()
    return Tour(texte=sortie.texte, liens=sortie.liens, bloque=sortie.bloque,
                proposer_contact=sortie.proposer_contact or contexte.proposer_contact,
                outils=list(dict.fromkeys(suivi.outils_appeles)), jetons_entree=jetons_in, jetons_sortie=jetons_out,
                duree_ms=int((time.monotonic() - debut) * 1000))


def tour_fond(*, consigne, langue, utilisateur, suivi, avec_outils=True, montants_source=(), jetons_max=1500,
              coordonnees_source=()):
    """Un tour de l'agent de fond (brouillon). Renvoie (texte brut contrôlé -> `Sortie`, jetons)."""
    contexte = outils.Contexte(utilisateur=None, langue=langue)
    instruction = _instruction("fond", langue, False)
    messages = [{"role": "user", "texte": consigne}]
    noms = outils.OUTILS_FOND if avec_outils else ()
    reponse = executer_boucle(agent="fond", modele=settings.GEMINI_MODELE_FOND, instruction=instruction,
                              messages=messages, noms_outils=noms, contexte=contexte, suivi=suivi,
                              utilisateur=utilisateur, temperature=0.3, jetons_max=jetons_max)
    return reponse


def coordonnees_avec(source_texte):
    """Coordonnées publiques + celles déjà présentes dans un texte source (traduction)."""
    base = outils.coordonnees_publiques()
    mails = tuple(base.emails) + tuple(v for _d, _f, v in garde_fous.emails_du_texte(source_texte))
    tels = tuple(base.telephones) + tuple(v for _d, _f, v in garde_fous.telephones_du_texte(source_texte))
    return Coordonnees(emails=mails, telephones=tels)
