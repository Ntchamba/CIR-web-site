"""Paiements (BF-10, BF-12) : un paiement = une tentative d'encaissement (mobile, lien CamPay) ou un règlement hors ligne.

Une commande n'est payée qu'après revérification auprès de l'API CamPay (voir services.py). Les montants sont des
entiers en FCFA. Aucun numéro de téléphone n'est écrit dans les journaux ni renvoyé en clair par l'API.
"""
import secrets

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.noyau.references import ReferenceMixin


class ModePaiement(models.TextChoices):
    MOBILE = "mobile", _("Mobile Money")
    LIEN = "lien", _("Carte ou lien de paiement")
    MANUEL = "manuel", _("Règlement hors ligne")


class EtatPaiement(models.TextChoices):
    EN_ATTENTE = "en_attente", _("En attente")
    REUSSI = "reussi", _("Réussi")
    ECHOUE = "echoue", _("Échoué")
    EXPIRE = "expire", _("Expiré")
    ANNULE = "annule", _("Annulé")
    ANOMALIE = "anomalie", _("Anomalie")


class RaisonPaiement(models.TextChoices):
    NUMERO_INVALIDE = "numero_invalide", _("Numéro de téléphone refusé par l'opérateur.")
    REFUSE = "refuse", _("Paiement refusé ou non validé.")
    EXPIRE = "expire", _("Le délai pour valider le paiement est dépassé.")
    MONTANT_DIFFERENT = "montant_different", _("Le montant reçu ne correspond pas à la demande.")
    INCONNUE = "inconnue", _("Cause inconnue.")


class ModeManuel(models.TextChoices):
    ESPECES = "especes", _("Espèces")
    VIREMENT = "virement", _("Virement")
    CHEQUE = "cheque", _("Chèque")
    AUTRE = "autre", _("Autre")


def nouvelle_reference_externe():
    """Aléatoire (« cir- » + 24 caractères hexadécimaux) : envoyée à CamPay, jamais devinable ni réutilisée."""
    return "cir-" + secrets.token_hex(12)


class Paiement(ReferenceMixin, models.Model):
    prefixe_reference = "PAY"

    reference = models.CharField("référence", max_length=20, unique=True, editable=False)  # PAY-2026-0001
    commande = models.ForeignKey("commandes.Commande", on_delete=models.PROTECT, related_name="paiements")
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="paiements")
    montant = models.PositiveIntegerField("montant (FCFA)")
    devise = models.CharField(max_length=3, default="XAF")
    mode = models.CharField(max_length=10, choices=ModePaiement.choices)
    etat = models.CharField("état", max_length=12, choices=EtatPaiement.choices, default=EtatPaiement.EN_ATTENTE,
                            db_index=True)
    telephone = models.CharField("téléphone (chiffres)", max_length=15, blank=True)  # jamais renvoyé en clair
    operateur = models.CharField("opérateur", max_length=40, blank=True)  # donné par CamPay, jamais deviné
    reference_externe = models.CharField(max_length=32, unique=True, default=nouvelle_reference_externe,
                                         editable=False)
    reference_campay = models.CharField(max_length=80, blank=True, db_index=True)
    code_ussd = models.CharField(max_length=60, blank=True)
    lien = models.URLField(max_length=1000, blank=True)
    reference_operateur = models.CharField(max_length=80, blank=True)
    raison = models.CharField(max_length=20, choices=RaisonPaiement.choices, blank=True)
    mode_manuel = models.CharField(max_length=10, choices=ModeManuel.choices, blank=True)
    note = models.CharField(max_length=300, blank=True)
    saisi_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name="+")
    cree_le = models.DateTimeField("créé le", auto_now_add=True, db_index=True)
    derniere_verification_le = models.DateTimeField("dernière vérification", null=True, blank=True)
    termine_le = models.DateTimeField("terminé le", null=True, blank=True)

    class Meta:
        verbose_name = "paiement"
        verbose_name_plural = "paiements"
        ordering = ["-cree_le", "-id"]
        constraints = [
            # Un seul paiement en attente par commande (filet de sécurité de la règle vérifiée dans services.py)
            models.UniqueConstraint(fields=["commande"], condition=models.Q(etat="en_attente"),
                                    name="paiements_un_seul_en_attente"),
            models.CheckConstraint(condition=models.Q(montant__gt=0), name="paiements_montant_positif"),
        ]

    def __str__(self):
        return self.reference
