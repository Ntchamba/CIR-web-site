"""Évaluations de l'assistant (`agents/evaluations/questions.json`).

Les tests vérifient seulement la validité du fichier et la logique de vérification (`verifier`) ; le rejeu contre le vrai
Gemini (`rejouer`) est réservé à la commande manuelle `evaluer_assistant`.
"""
import json
import re

from . import garde_fous, orchestrateur
from .garde_fous import PRIX

LANGUES = ("fr", "en", "zh", "de", "ja")
MARQUEURS = ("@proposer_contact", "@aucun_montant", "@aucun_lien", "@bloque")
_ADRESSE = re.compile(r"https?://|www\.|\[[^\]]*\]\(", re.IGNORECASE)


def charger():
    fichier = orchestrateur.dossier_agents() / "evaluations" / "questions.json"
    return json.loads(fichier.read_text(encoding="utf-8"))


def erreurs_de_forme(questions):
    """Liste des défauts du fichier (vide si valide)."""
    erreurs, vus = [], set()
    if not isinstance(questions, list):
        return ["Le fichier doit contenir une liste de cas."]
    for i, q in enumerate(questions):
        etiquette = q.get("id", f"#{i}") if isinstance(q, dict) else f"#{i}"
        if not isinstance(q, dict):
            erreurs.append(f"{etiquette} : cas invalide")
            continue
        if not isinstance(q.get("id"), str) or not q["id"] or q["id"] in vus:
            erreurs.append(f"{etiquette} : identifiant absent ou en double")
        vus.add(q.get("id"))
        if q.get("langue") not in LANGUES:
            erreurs.append(f"{etiquette} : langue inconnue")
        if not isinstance(q.get("question"), str) or not q["question"].strip():
            erreurs.append(f"{etiquette} : question vide")
        attendu = q.get("attendu")
        if not isinstance(attendu, dict) or not isinstance(attendu.get("doit"), list) \
                or not isinstance(attendu.get("ne_doit_pas"), list):
            erreurs.append(f"{etiquette} : attendu.doit et attendu.ne_doit_pas sont obligatoires")
            continue
        for motif in attendu["doit"] + attendu["ne_doit_pas"]:
            if not isinstance(motif, str) or not motif or (motif.startswith("@") and motif not in MARQUEURS):
                erreurs.append(f"{etiquette} : motif invalide {motif!r}")
        if "outils" in attendu and not (isinstance(attendu["outils"], list)
                                        and all(isinstance(o, str) for o in attendu["outils"])):
            erreurs.append(f"{etiquette} : outils invalides")
        if "contexte" in q and not isinstance(q["contexte"], dict):
            erreurs.append(f"{etiquette} : contexte invalide")
    return erreurs


def _presente(motif, texte, proposer_contact, bloque):
    if motif == "@proposer_contact":
        return proposer_contact
    if motif == "@aucun_montant":
        return bool(garde_fous.montants_du_texte(texte))
    if motif == "@aucun_lien":
        return bool(_ADRESSE.search(texte))
    if motif == "@bloque":
        return bool(bloque)
    return any(v.strip().lower() in texte.lower() for v in motif.split("|") if v.strip())


def verifier(attendu, *, texte, outils_appeles=(), proposer_contact=False, bloque=""):
    """Compare une réponse à l'attendu. Marqueur `@x` dans `doit` : x doit être vrai ; dans `ne_doit_pas` : x faux
    (`@aucun_montant` : « aucun montant » est attendu, donc dans `doit`)."""
    manques = []
    for motif in attendu["doit"]:
        if motif in ("@aucun_montant", "@aucun_lien"):
            if _presente(motif, texte, proposer_contact, bloque):
                manques.append(f"doit : {motif}")
        elif not _presente(motif, texte, proposer_contact, bloque):
            manques.append(f"doit : {motif}")
    for motif in attendu["ne_doit_pas"]:
        if _presente(motif, texte, proposer_contact, bloque):
            manques.append(f"ne doit pas : {motif}")
    for nom in attendu.get("outils", []):
        if nom not in outils_appeles:
            manques.append(f"outil attendu : {nom}")
    return manques


def rejouer(question):
    """Rejoue un cas contre Gemini (visiteur sans compte). Réservé à la commande manuelle."""
    suivi = orchestrateur.Suivi()
    try:
        tour = orchestrateur.tour_conseiller(texte=question["question"], messages_precedents=[],
                                             langue=question["langue"], utilisateur=None,
                                             contexte_page=question.get("contexte"), suivi=suivi)
    except Exception as erreur:  # noqa: BLE001
        return {"id": question["id"], "reussi": False, "erreur": type(erreur).__name__}
    manques = verifier(question["attendu"], texte=tour.texte, outils_appeles=tour.outils,
                       proposer_contact=tour.proposer_contact, bloque=tour.bloque)
    return {"id": question["id"], "langue": question["langue"], "question": question["question"],
            "reponse": tour.texte, "outils": tour.outils, "bloque": tour.bloque, "reussi": not manques,
            "ecarts": manques}
