"""Mise en forme des appels (voir `services.appel_en_dict`) et contrôle de forme des demandes."""
from rest_framework import serializers

from .models import TypeAppel
from .services import appel_en_dict


class AppelSerializer(serializers.Serializer):
    def to_representation(self, appel):
        return appel_en_dict(appel)


class AppelEquipeSerializer(AppelSerializer):
    """Historique de l'équipe : les appels manqués portent de quoi rappeler le client."""

    def to_representation(self, appel):
        donnees = super().to_representation(appel)
        donnees["rappel"] = None
        if appel.etat == "manque":
            donnees["rappel"] = {"telephone": appel.client.telephone,
                                 "lien_messagerie": f"/messagerie?client={appel.client_id}"}
        return donnees


class LancerAppelSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=TypeAppel.choices)
    commande = serializers.IntegerField(required=False, allow_null=True, default=None)
