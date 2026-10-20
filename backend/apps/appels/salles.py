"""Salles d'appel, sonnerie et délais.

- Le nom de salle est tiré au hasard (`secrets`) : « cir- » + 24 caractères hexadécimaux, jamais devinable.
- Un appel sonne **60 secondes**. L'expiration est calculée à partir de la base (date de lancement), jamais par un
  minuteur en mémoire : elle s'applique à chaque lecture de l'appel et par la commande `expirer_appels`.
- Les jetons viennent de `integrations.jaas` (aucune clé ici).
"""
import secrets
from datetime import timedelta

from integrations.jaas import jetons, webhooks  # noqa: F401 (webhooks : utilisé par les vues)
from integrations.jaas.erreurs import JaasNonConfigure

DELAI_SONNERIE = timedelta(seconds=60)
# Filet de sécurité si le webhook n'arrive pas : un appel « en cours » depuis plus longtemps est considéré terminé
DUREE_MAX_APPEL = timedelta(hours=3)
DUREE_JETON_SECONDES = 2 * 60 * 60


def nouvelle_salle():
    return "cir-" + secrets.token_hex(12)


def configure():
    return jetons.configure()


def parametres_client():
    return jetons.parametres_client()


def jitsi_pour(appel, utilisateur, moderateur):
    """`{domaine, app_id, salle, jeton}` pour que `utilisateur` rejoigne la salle de l'appel.

    Participant (client) ou modérateur (équipe). Lève `JaasNonConfigure` si le service n'est pas configuré.
    """
    jeton = jetons.creer_jeton(salle=appel.salle, utilisateur_id=utilisateur.pk, nom=utilisateur.nom_complet,
                               email=utilisateur.email, moderateur=moderateur,
                               duree_secondes=DUREE_JETON_SECONDES)
    return {**jetons.parametres_client(), "salle": appel.salle, "jeton": jeton}


__all__ = ["DELAI_SONNERIE", "DUREE_MAX_APPEL", "JaasNonConfigure", "nouvelle_salle", "configure",
           "parametres_client", "jitsi_pour"]
