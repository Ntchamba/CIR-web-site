"""Champs de sérialiseur communs : listes envoyées en chaîne JSON dans un formulaire multipart.

Quand le tableau de bord envoie un fichier (`multipart/form-data`), les valeurs structurées (`traductions`,
`caracteristiques`, `couches`, `produits`) arrivent sous forme de **chaînes JSON**. Le champ `JSONField` de
DRF sait déjà les lire (`traductions`) ; les classes ci-dessous font de même pour les listes d'objets
imbriqués et les listes d'identifiants. En JSON, rien ne change.
"""
import json

from rest_framework import serializers
from rest_framework.utils import html


def _lire_json(dictionnaire, nom):
    """Valeur JSON d'un champ de formulaire, ou None si le champ n'est pas une chaîne JSON lisible."""
    valeurs = dictionnaire.getlist(nom)
    if len(valeurs) != 1 or not isinstance(valeurs[0], str):
        return None
    try:
        return json.loads(valeurs[0])
    except ValueError:
        return valeurs[0]  # chaîne illisible : refusée ensuite par la validation (« liste attendue »)


class ListeJSONSerializer(serializers.ListSerializer):
    """Liste d'objets imbriqués acceptant une chaîne JSON en multipart (`Meta.list_serializer_class`)."""

    def get_value(self, dictionary):
        if html.is_html_input(dictionary) and self.field_name in dictionary:
            valeur = _lire_json(dictionary, self.field_name)
            if valeur is not None:
                return valeur
        return super().get_value(dictionary)


class RelationsJSON(serializers.ManyRelatedField):
    """Liste d'identifiants (`produits`) : JSON, champs répétés ou chaîne JSON « [1, 2] » en multipart.

    Usage : `RelationsJSON(child_relation=PrimaryKeyRelatedField(queryset=…), required=False)`.
    """

    def get_value(self, dictionary):
        if html.is_html_input(dictionary) and self.field_name in dictionary:
            valeurs = dictionary.getlist(self.field_name)
            if len(valeurs) == 1 and isinstance(valeurs[0], str) and valeurs[0].strip().startswith("["):
                valeur = _lire_json(dictionary, self.field_name)
                return valeur
            if valeurs == [""]:
                return []
        return super().get_value(dictionary)
