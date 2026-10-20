"""Mise en forme des paiements (voir `services.paiement_en_dict`) et contrôle de forme des demandes."""
from rest_framework import serializers

from apps.noyau.montants import MONTANT_MAX

from . import services
from .models import ModeManuel, ModePaiement


class PaiementSerializer(serializers.Serializer):
    def to_representation(self, paiement):
        return services.paiement_en_dict(paiement)


class PaiementEquipeSerializer(serializers.Serializer):
    def to_representation(self, paiement):
        return services.paiement_en_dict(paiement, equipe=True)


class InitierSerializer(serializers.Serializer):
    commande = serializers.IntegerField(min_value=1, max_value=MONTANT_MAX)
    mode = serializers.ChoiceField(choices=[ModePaiement.MOBILE, ModePaiement.LIEN], required=False,
                                   default=ModePaiement.MOBILE)
    telephone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=40, default=None)
    montant = serializers.IntegerField(required=False, allow_null=True, default=None)


class ReglementSerializer(serializers.Serializer):
    montant = serializers.IntegerField()
    mode_manuel = serializers.ChoiceField(choices=ModeManuel.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=300, default="")
