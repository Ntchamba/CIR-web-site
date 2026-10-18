"""Réactions du devis aux signaux de la négociation (`apps/commandes/signals.py`).

Proposition acceptée → devis « accepté » ; refusée → « refusé » ; remplacée → « remplacé ». Seul un devis encore
« envoyé » change d'état. `commandes` n'importe jamais ce module : les signaux sont l'unique lien.
"""
from django.dispatch import receiver
from django.utils import timezone

from apps.commandes.signals import proposition_acceptee, proposition_refusee, proposition_remplacee

from .models import Devis, EtatDevis


def _passer(proposition, etat):
    if proposition.devis_id:
        Devis.objects.filter(pk=proposition.devis_id, etat=EtatDevis.ENVOYE).update(etat=etat,
                                                                                    modifie_le=timezone.now())


@receiver(proposition_acceptee)
def devis_accepte(sender, proposition, **kwargs):
    _passer(proposition, EtatDevis.ACCEPTE)


@receiver(proposition_refusee)
def devis_refuse(sender, proposition, **kwargs):
    _passer(proposition, EtatDevis.REFUSE)


@receiver(proposition_remplacee)
def devis_remplace(sender, proposition, **kwargs):
    _passer(proposition, EtatDevis.REMPLACE)
