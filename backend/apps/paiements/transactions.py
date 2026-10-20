"""Seul point de contact du module avec CamPay (`integrations.campay`).

- les appels réseau sont faits ici et nulle part ailleurs dans `paiements` (les tests remplacent ces fonctions) ;
- les erreurs de l'intégration sont traduites en trois cas simples : `Indisponible` (réessayer plus tard),
  `Refuse` (échec définitif, avec une raison) et `NonConfigure` ;
- `evaluer` compare une transaction CamPay au paiement enregistré : c'est la seule règle qui décide de l'encaissement.

Ni clé, ni jeton, ni numéro de téléphone complet ne sont écrits dans les journaux.
"""
import logging
import os

from django.conf import settings
from integrations.campay import client, telephone, webhooks
from integrations.campay.erreurs import CampayErreurDefinitive, CampayErreurTemporaire, CampayNonConfigure
from integrations.campay.telephone import TelephoneInvalide  # noqa: F401 (réexporté pour services.py)

from .models import EtatPaiement, RaisonPaiement

journal = logging.getLogger("cir.paiements")


class NonConfigure(Exception):
    """CamPay n'est pas configuré."""


class Indisponible(Exception):
    """CamPay ne répond pas (réseau, délai, 5xx) ou a répondu de façon illisible : on réessaiera."""


class Refuse(Exception):
    """Refus définitif de CamPay ; `raison` est un code de `RaisonPaiement`."""

    def __init__(self, raison):
        super().__init__(raison)
        self.raison = raison


_RAISONS = {"numero_invalide": RaisonPaiement.NUMERO_INVALIDE, "montant_invalide": RaisonPaiement.REFUSE,
            "refuse": RaisonPaiement.REFUSE, "inconnue": RaisonPaiement.INCONNUE}


def configure():
    return client.configure()


def webhook_configure():
    return bool(os.environ.get("CAMPAY_WEBHOOK_KEY", "").strip())


def normaliser_telephone(texte):
    """`237699001122` ; lève `TelephoneInvalide`."""
    return telephone.normaliser(texte)


def masquer_telephone(numero):
    return telephone.masquer(numero) if numero else None


def _appeler(fonction, **arguments):
    try:
        return fonction(**arguments)
    except CampayNonConfigure:
        raise NonConfigure() from None
    except CampayErreurTemporaire:
        journal.warning("CamPay indisponible (%s).", getattr(fonction, "__name__", "appel"))
        raise Indisponible() from None
    except CampayErreurDefinitive as erreur:
        raise Refuse(_RAISONS.get(erreur.code, RaisonPaiement.INCONNUE)) from None
    except ValueError:  # argument refusé avant l'appel (ex. adresse de retour) : problème de configuration
        journal.error("Requête CamPay refusée avant l'envoi (%s).", getattr(fonction, "__name__", "appel"))
        raise Indisponible() from None


def lancer_mobile(paiement, description):
    """Demande de validation sur le téléphone du client. Renvoie `(reference_campay, code_ussd, operateur)`."""
    collecte = _appeler(client.initier_collecte, montant=paiement.montant, telephone=paiement.telephone,
                        description=description, reference_externe=paiement.reference_externe)
    return collecte.reference, collecte.code_ussd, collecte.operateur


def lancer_lien(paiement, description, url_retour, url_echec):
    """Adresse de paiement CamPay (carte ou mobile money)."""
    return _appeler(client.lien_paiement, montant=paiement.montant, description=description,
                    reference_externe=paiement.reference_externe, url_retour=url_retour, url_echec=url_echec)


def interroger(paiement):
    """Transaction CamPay du paiement (`GET transaction`). Lève `Indisponible`, `Refuse` ou `NonConfigure`."""
    return _appeler(client.statut, reference=paiement.reference_campay)


def interroger_reference(reference):
    """Transaction CamPay désignée par une référence **non fiable** (candidate à l'adoption, voir services)."""
    return _appeler(client.statut, reference=reference)


def evaluer(paiement, transaction):
    """Compare la transaction CamPay au paiement enregistré. Renvoie `(etat, raison)`.

    - `reussi` seulement si le statut est « reussi » ET que montant, devise et référence externe sont identiques ;
    - « reussi » mais différent : `anomalie` (rien n'est encaissé) ;
    - un statut inconnu a déjà été ramené à « en_attente » par l'intégration : jamais « réussi » par défaut.
    """
    if transaction.statut == "reussi":
        identique = (transaction.montant == paiement.montant
                     and (transaction.devise or "").upper() == paiement.devise
                     # La transaction est lue par la référence CamPay du paiement : si l'API ne renvoie pas la
                     # référence externe, on ne peut pas la comparer (pas d'anomalie) ; si elle la renvoie, elle doit être la nôtre.
                     and (not transaction.reference_externe
                          or transaction.reference_externe == paiement.reference_externe))
        if identique:
            return EtatPaiement.REUSSI, ""
        return EtatPaiement.ANOMALIE, RaisonPaiement.MONTANT_DIFFERENT
    if transaction.statut == "echoue":
        raison = transaction.raison if transaction.raison in RaisonPaiement.values else RaisonPaiement.REFUSE
        return EtatPaiement.ECHOUE, raison
    return EtatPaiement.EN_ATTENTE, ""


def signature_valide(parametres):
    return webhooks.verifier_signature(parametres)


def evenement(parametres):
    """`EvenementCampay` (valeurs non fiables : elles servent seulement à retrouver le paiement) ou None."""
    return webhooks.analyser(parametres)


def delai_expiration_minutes():
    return settings.PAIEMENT_EXPIRATION_MINUTES
