"""Sérialiseurs des commandes : mise en forme et contrôle de forme. Les règles sont dans services.py et negociation.py.

Montants en FCFA : chaîne ou null en sortie, nombre ou chaîne de chiffres en entrée (`ChampPrix`). Surfaces :
décimales à 2 chiffres en chaîne. `actions_possibles` et `peut_repondre` sont calculés ici d'après le rôle de la
requête (`context["role"]`), jamais par le front. Les `notes_internes` ne sortent que dans les sérialiseurs équipe.
"""
from rest_framework import serializers

from apps.catalogue.prix import ChampPrix
from apps.catalogue.serializers import ProduitCarteSerializer

from . import contrats, extensions
from .etapes import CLIENT, Etat, actions_possibles
from .models import ChangementEtat, Commande, EtatProposition, LigneCommande, Proposition, TypeBatiment

DATE_HEURE = serializers.DateTimeField()


def _role(serialiseur):
    return serialiseur.context.get("role", CLIENT)


def _date(valeur):
    return None if valeur is None else DATE_HEURE.to_representation(valeur)


# --- Lignes ---

class ProduitLigneSerializer(ProduitCarteSerializer):
    class Meta(ProduitCarteSerializer.Meta):
        fields = ["id", "slug", "reference", "nom", "image"]
        read_only_fields = fields


class LigneSerializer(serializers.ModelSerializer):
    """Ligne de commande. Le nom du produit est celui du catalogue (traduit) ; à défaut, l'instantané français."""

    produit = serializers.SerializerMethodField()
    design = serializers.SerializerMethodField()

    class Meta:
        model = LigneCommande
        fields = ["id", "produit", "design"]
        read_only_fields = fields

    def get_produit(self, ligne):
        if ligne.produit is not None:
            return ProduitLigneSerializer(ligne.produit, context=self.context).data
        if not ligne.produit_nom:
            return None
        return {"id": None, "slug": None, "reference": ligne.produit_reference, "nom": ligne.produit_nom,
                "image": None}

    def get_design(self, ligne):
        if ligne.design is not None:
            return {"id": ligne.design.pk, "nom": ligne.design.traduit("nom"), "couleur": ligne.design.couleur}
        if not ligne.design_nom:
            return None
        return {"id": None, "nom": ligne.design_nom, "couleur": ""}


# --- Négociation ---

class PropositionSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.CharField(source="auteur.nom_complet", read_only=True)
    prix_m2 = ChampPrix(read_only=True)
    total = ChampPrix(read_only=True)
    devis = serializers.SerializerMethodField()
    peut_repondre = serializers.SerializerMethodField()

    class Meta:
        model = Proposition
        fields = ["id", "auteur_role", "auteur_nom", "prix_m2", "total", "delai_jours", "message", "etat", "reponse",
                  "devis", "peut_repondre", "cree_le", "repondu_le"]
        read_only_fields = fields

    def get_devis(self, proposition):
        return proposition.devis_id

    def get_peut_repondre(self, proposition):
        """Vrai si le demandeur (client ou équipe, d'après la requête) peut accepter ou refuser cette proposition."""
        commande = self.context.get("commande") or proposition.commande
        return (proposition.etat == EtatProposition.EN_ATTENTE and commande.etat == Etat.NEGOCIATION
                and proposition.auteur_role != _role(self))


class PropositionEntreeSerializer(serializers.Serializer):
    prix_m2 = ChampPrix()
    total = ChampPrix()
    delai_jours = serializers.IntegerField(required=False, allow_null=True, min_value=1, default=None)
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="",
                                    trim_whitespace=False)


class ReponseSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="",
                                    trim_whitespace=False)


class HistoriqueSerializer(serializers.ModelSerializer):
    par = serializers.CharField(source="auteur_role", read_only=True)

    class Meta:
        model = ChangementEtat
        fields = ["de", "vers", "par", "motif", "cree_le"]
        read_only_fields = fields

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        donnees["motif"] = donnees["motif"] or None  # texte ou null
        return donnees


# --- Lecture : listes ---

class CommandeListeSerializer(serializers.ModelSerializer):
    nombre_lignes = serializers.IntegerField(read_only=True)
    action_requise = serializers.BooleanField(read_only=True)
    montant_convenu = ChampPrix(read_only=True)

    class Meta:
        model = Commande
        fields = ["id", "reference", "type_batiment", "etat", "surface_m2", "nombre_lignes", "montant_convenu",
                  "action_requise", "modifie_le", "cree_le"]
        read_only_fields = fields


class ClientResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    email = serializers.CharField(read_only=True)
    telephone = serializers.CharField(read_only=True)
    ville = serializers.CharField(read_only=True)


class ClientDetailSerializer(ClientResumeSerializer):
    quartier = serializers.CharField(read_only=True)
    rue_ou_repere = serializers.CharField(read_only=True)
    langue = serializers.CharField(read_only=True)


class CommandeListeEquipeSerializer(CommandeListeSerializer):
    client = ClientResumeSerializer(read_only=True)

    class Meta(CommandeListeSerializer.Meta):
        fields = ["id", "reference", "type_batiment", "etat", "surface_m2", "nombre_lignes", "montant_convenu",
                  "client", "action_requise", "modifie_le", "cree_le"]
        read_only_fields = fields


# --- Lecture : détail ---

class CommandeDetailSerializer(serializers.ModelSerializer):
    adresse = serializers.SerializerMethodField()
    lignes = serializers.SerializerMethodField()
    montant_convenu = ChampPrix(read_only=True)
    prix_m2_convenu = ChampPrix(read_only=True)
    propositions = serializers.SerializerMethodField()
    historique = HistoriqueSerializer(many=True, read_only=True)
    contrat = serializers.SerializerMethodField()
    devis = serializers.SerializerMethodField()
    action_requise = serializers.SerializerMethodField()
    actions_possibles = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = ["id", "reference", "type_batiment", "etat", "surface_m2", "description", "adresse", "lignes",
                  "montant_convenu", "prix_m2_convenu", "delai_convenu_jours", "signe_le", "propositions",
                  "historique", "contrat", "devis", "action_requise", "actions_possibles", "cree_le", "modifie_le"]
        read_only_fields = fields

    def get_adresse(self, commande):
        return {"ville": commande.ville, "quartier": commande.quartier, "rue_ou_repere": commande.rue_ou_repere}

    def _lignes(self, commande):
        cache = getattr(commande, "_lignes_serialisees", None)
        if cache is None:
            cache = commande._lignes_serialisees = LigneSerializer(commande.lignes.all(), many=True,
                                                                   context=self.context).data
        return cache

    def get_lignes(self, commande):
        return self._lignes(commande)

    def get_propositions(self, commande):
        contexte = {**self.context, "commande": commande}
        return PropositionSerializer(commande.propositions.all(), many=True, context=contexte).data

    def get_contrat(self, commande):
        contrat = contrats.contrat_de(commande)
        if contrat is not None:
            contrat["signe_le"] = _date(contrat["signe_le"])
        return contrat

    def get_devis(self, commande):
        return extensions.devis_de(commande, self.context.get("request"), _role(self) != CLIENT)

    def get_action_requise(self, commande):
        valeur = getattr(commande, "action_requise", None)
        if valeur is not None:
            return bool(valeur)
        attente = [p for p in commande.propositions.all() if p.etat == EtatProposition.EN_ATTENTE]
        if _role(self) == CLIENT:
            return any(p.auteur_role == "equipe" for p in attente)
        return commande.etat == Etat.NOUVELLE or any(p.auteur_role == "client" for p in attente)

    def get_actions_possibles(self, commande):
        return actions_possibles(commande.etat, _role(self))


class CommandeDetailEquipeSerializer(CommandeDetailSerializer):
    client = ClientDetailSerializer(read_only=True)

    class Meta(CommandeDetailSerializer.Meta):
        fields = CommandeDetailSerializer.Meta.fields + ["client", "notes_internes"]
        read_only_fields = fields


# --- Écriture ---

class LigneEntreeSerializer(serializers.Serializer):
    produit = serializers.IntegerField()
    design = serializers.IntegerField(required=False, allow_null=True, default=None)


class CommandeCreationSerializer(serializers.Serializer):
    type_batiment = serializers.ChoiceField(choices=TypeBatiment.choices)
    surface_m2 = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True,
                                          default=None)
    description = serializers.CharField(max_length=1500, required=False, allow_blank=True, default="",
                                        trim_whitespace=False)
    lignes = LigneEntreeSerializer(many=True, required=False, default=list)
    depuis_selection = serializers.BooleanField(required=False, default=False)


class CommandeModifClientSerializer(serializers.Serializer):
    surface_m2 = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    description = serializers.CharField(max_length=1500, required=False, allow_blank=True, trim_whitespace=False)


class CommandeModifEquipeSerializer(serializers.Serializer):
    surface_m2 = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    notes_internes = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)


class MotifSerializer(serializers.Serializer):
    motif = serializers.CharField(max_length=500, required=False, allow_blank=True, default="", trim_whitespace=False)


class EtatEquipeSerializer(MotifSerializer):
    etat = serializers.ChoiceField(choices=Etat.choices)
