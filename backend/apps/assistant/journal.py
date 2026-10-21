"""Journal de l'assistant : une ligne par appel à Gemini. Jamais le texte ni de donnée personnelle.

Une panne du journal ne fait jamais échouer l'action d'origine.
"""
import logging

from .models import JournalAssistant

journal = logging.getLogger("cir.assistant")


def enregistrer(*, agent, resultat, utilisateur=None, modele="", outils=(), code="", jetons_entree=0,
                jetons_sortie=0, duree_ms=0):
    try:
        return JournalAssistant.objects.create(
            agent=agent, utilisateur=utilisateur if getattr(utilisateur, "pk", None) else None, modele=modele[:80],
            outils=list(outils), resultat=resultat, code=str(code)[:40], jetons_entree=int(jetons_entree),
            jetons_sortie=int(jetons_sortie), duree_ms=int(duree_ms))
    except Exception:  # noqa: BLE001
        journal.exception("Écriture du journal de l'assistant impossible.")
        return None
