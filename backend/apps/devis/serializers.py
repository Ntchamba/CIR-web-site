"""Sérialiseurs des devis et des demandes de rendu. Les règles sont dans services.py, le calcul dans calcul.py.

Montants en FCFA : chaîne ou null en sortie, nombre ou chaîne de chiffres en entrée (`ChampPrix`). Surfaces à
2 décimales, dosages à 3 décimales, quantités à 2 décimales : en chaîne. Les `notes_internes` ne sortent que
dans les sérialiseurs équipe.
"""
from rest_framework import serializers

from apps.catalogue.models import Produit
from apps.catalogue.prix import ChampPrix
from apps.commandes.models import Commande, TypeBatiment
from apps.noyau.medias import objet_image
from apps.noyau.traductions import SerialiseurTraduitMixin

from . import calcul, services
from .models import DemandeRendu, Devis, EtatDemande, LigneDevis, TypeLigne


def _decimal(valeur, decimales):
    return None if valeur is None else f"{valeur:.{decimales}f}"


def _entier(valeur):
    return None if valeur is None else str(valeur)


# --- Lignes ---

def representation_ligne(ligne, resultat, *, equipe, libelle, id=None, produit=None, libelle_brut=None):
    """Ligne mise en forme : `ligne` (dict des champs saisis) et `resultat` (calcul.ResultatLigne)."""
    donnees = {
        "ordre": ligne.get("ordre", 0),
        "type_ligne": ligne.get("type_ligne"),
        "libelle": libelle,
        "surface_m2": _decimal(ligne.get("surface_m2"), 2),
        "dosage_kg_m2": _decimal(ligne.get("dosage_kg_m2"), 3),
        "quantite_kg": _decimal(resultat.quantite_kg, 2),
        "prix_kg": _entier(ligne.get("prix_kg")),
        "prix_m2": _entier(ligne.get("prix_m2")),
        "montant": _entier(resultat.montant),
    }
    if equipe:
        # équipe : `libelle` = valeur saisie (peut être vide), `libelle_affiche` = libellé ou nom traduit du produit
        donnees = {"id": id, **donnees, "libelle": libelle_brut or "", "libelle_affiche": libelle,
                   "produit": produit, "montant_forfait": _entier(ligne.get("montant_forfait"))}
    return donnees


class LigneDevisSerializer(serializers.ModelSerializer):
    """Ligne enregistrée. `equipe` (contexte) ajoute id, produit et montant du forfait."""

    class Meta:
        model = LigneDevis
        fields = ["id"]
        read_only_fields = fields

    def to_representation(self, ligne):
        saisie = {**ligne.donnees_calcul(), "ordre": ligne.ordre}
        return representation_ligne(saisie, ligne.resultat, equipe=self.context.get("equipe", False),
                                    libelle=ligne.libelle_affiche, id=ligne.pk, produit=ligne.produit_id,
                                    libelle_brut=ligne.libelle)


class LigneDevisEntreeSerializer(serializers.Serializer):
    """Ligne saisie (brouillon ou aperçu) : tout est facultatif, les manques sont signalés par le calcul."""

    type_ligne = serializers.ChoiceField(choices=TypeLigne.choices)
    libelle = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.all(), required=False, allow_null=True,
                                                 default=None)
    surface_m2 = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False,
                                          allow_null=True, default=None)
    dosage_kg_m2 = serializers.DecimalField(max_digits=8, decimal_places=3, min_value=0, required=False,
                                            allow_null=True, default=None)
    prix_kg = ChampPrix()
    prix_m2 = ChampPrix()
    montant_forfait = ChampPrix()


# --- Devis ---

class DevisResumeSerializer(serializers.ModelSerializer):
    commande_reference = serializers.CharField(source="commande.reference", read_only=True)
    expire = serializers.BooleanField(read_only=True)
    total = serializers.SerializerMethodField()
    valide_jusqu_au = serializers.DateField(read_only=True)

    class Meta:
        model = Devis
        fields = ["id", "reference", "commande", "commande_reference", "etat", "expire", "total", "valide_jusqu_au",
                  "envoye_le"]
        read_only_fields = fields

    def get_total(self, devis):
        return str(devis.total)


class DevisDetailSerializer(DevisResumeSerializer):
    lignes = LigneDevisSerializer(many=True, read_only=True)

    class Meta(DevisResumeSerializer.Meta):
        fields = DevisResumeSerializer.Meta.fields + ["lignes", "notes"]
        read_only_fields = fields


class DevisAdminListeSerializer(DevisResumeSerializer):
    client = serializers.SerializerMethodField()

    class Meta(DevisResumeSerializer.Meta):
        fields = DevisResumeSerializer.Meta.fields + ["client", "validite_jours", "demande", "cree_le"]
        read_only_fields = fields

    def get_client(self, devis):
        client = devis.commande.client
        return {"id": client.pk, "nom_complet": client.nom_complet}


class DevisAdminSerializer(DevisAdminListeSerializer):
    lignes = serializers.SerializerMethodField()
    cree_par = serializers.SerializerMethodField()
    complet = serializers.SerializerMethodField()

    class Meta(DevisAdminListeSerializer.Meta):
        fields = DevisAdminListeSerializer.Meta.fields + ["lignes", "notes", "cree_par", "complet", "modifie_le"]
        read_only_fields = fields

    def get_lignes(self, devis):
        contexte = {**self.context, "equipe": True}
        return LigneDevisSerializer(devis.lignes.all(), many=True, context=contexte).data

    def get_cree_par(self, devis):
        auteur = devis.cree_par
        return {"id": auteur.pk, "nom_complet": auteur.nom_complet} if auteur else None

    def get_complet(self, devis):
        return devis.resultat().complet


class DevisEcritureSerializer(serializers.Serializer):
    """Création (avec `commande`) et modification (`commande` ignorée) d'un brouillon."""

    commande = serializers.PrimaryKeyRelatedField(queryset=Commande.objects.all(), required=False)
    demande = serializers.PrimaryKeyRelatedField(queryset=DemandeRendu.objects.all(), required=False,
                                                 allow_null=True)
    validite_jours = serializers.IntegerField(min_value=1, max_value=365, required=False)
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True, trim_whitespace=False)
    lignes = LigneDevisEntreeSerializer(many=True, required=False, max_length=100)


class ApercuSerializer(serializers.Serializer):
    lignes = LigneDevisEntreeSerializer(many=True, max_length=100)


def apercu_representation(lignes):
    """Réponse de `POST calculer/` : lignes calculées, total, `complet` et erreurs par ligne."""
    resultat = services.apercu(lignes)
    sortie = []
    for ordre, (ligne, calcule) in enumerate(zip(lignes, resultat.lignes)):
        produit = ligne.get("produit")
        libelle = ligne.get("libelle") or (produit.traduit("nom") if produit else "")
        sortie.append(representation_ligne({**ligne, "ordre": ordre}, calcule, equipe=True, libelle=libelle,
                                           id=None, produit=produit.pk if produit else None,
                                           libelle_brut=ligne.get("libelle")))
    return {"lignes": sortie, "total": str(resultat.total), "complet": resultat.complet,
            "erreurs": resultat.erreurs}


# --- Demandes de rendu ---

class ProduitMiniSerializer(SerialiseurTraduitMixin, serializers.ModelSerializer):
    class Meta:
        model = Produit
        fields = ["id", "slug", "reference", "nom"]
        read_only_fields = fields


class DemandeRenduSerializer(serializers.ModelSerializer):
    produit = ProduitMiniSerializer(read_only=True)
    commande = serializers.PrimaryKeyRelatedField(read_only=True)
    images = serializers.SerializerMethodField()
    devis = DevisResumeSerializer(many=True, read_only=True)

    class Meta:
        model = DemandeRendu
        fields = ["id", "reference", "description", "type_batiment", "surface_m2", "produit", "commande", "images",
                  "etat", "reponse_equipe", "devis", "cree_le"]
        read_only_fields = fields

    def get_images(self, demande):
        requete = self.context.get("request")
        return [objet_image(requete, image.image, "") for image in demande.images.all()]


class DemandeRenduAdminSerializer(DemandeRenduSerializer):
    client = serializers.SerializerMethodField()

    class Meta(DemandeRenduSerializer.Meta):
        fields = DemandeRenduSerializer.Meta.fields + ["client", "notes_internes", "modifie_le"]
        read_only_fields = fields

    def get_client(self, demande):
        client = demande.client
        return {"id": client.pk, "nom_complet": client.nom_complet, "email": client.email,
                "telephone": client.telephone}


class DemandeRenduEntreeSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=5000, trim_whitespace=False)
    type_batiment = serializers.ChoiceField(choices=TypeBatiment.choices)
    surface_m2 = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True,
                                          default=None)
    produit = serializers.IntegerField(required=False, allow_null=True, default=None)
    commande = serializers.IntegerField(required=False, allow_null=True, default=None)
    images = serializers.ListField(child=serializers.FileField(allow_empty_file=False), required=False,
                                   max_length=services.IMAGES_MAX)


class DemandeRenduMajSerializer(serializers.Serializer):
    etat = serializers.ChoiceField(choices=EtatDemande.choices, required=False)
    reponse_equipe = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    notes_internes = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
