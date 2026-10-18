"""Anti-robot du formulaire de contact : champ piège et quota par adresse IP.

- Champ piège `site_web` : masqué pour les visiteurs, un robot le remplit. S'il est rempli, la réponse est un
  faux succès et rien n'est enregistré (le robot ne sait pas qu'il a été repéré).
- Quota : 5 demandes par heure et par adresse IP (`DEFAULT_THROTTLE_RATES["contact"]`), toujours par adresse IP,
  même pour un client connecté (le quota par compte, 10 par jour, est dans services.py).
"""
from collections.abc import Mapping

from rest_framework.throttling import SimpleRateThrottle


class QuotaContactIP(SimpleRateThrottle):
    scope = "contact"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def piege_rempli(donnees):
    """Vrai si le champ piège `site_web` contient quelque chose."""
    if not isinstance(donnees, Mapping):  # corps JSON qui n'est pas un objet : le sérialiseur répondra 400
        return False
    return bool(str(donnees.get("site_web") or "").strip())
