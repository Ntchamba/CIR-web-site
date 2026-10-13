from rest_framework import serializers

from apps.catalog.models import Produit

from .models import ETAPES, Commande, HistoriqueStatut, LigneCommande, Proposition, Statut


class LigneCommandeSerializer(serializers.ModelSerializer):
    produit = serializers.SlugRelatedField(slug_field="slug", queryset=Produit.objects.all())
    produit_nom = serializers.CharField(source="produit.nom", read_only=True)
    produit_reference = serializers.CharField(source="produit.reference", read_only=True)
    vignette = serializers.SerializerMethodField()

    class Meta:
        model = LigneCommande
        fields = ["id", "produit", "produit_nom", "produit_reference", "vignette", "surface_m2", "teinte",
                  "remarque"]

    def get_vignette(self, ligne):
        image = ligne.produit.images.first()
        if not image:
            return None
        requete = self.context.get("request")
        return requete.build_absolute_uri(image.image.url) if requete else image.image.url


class PropositionSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.CharField(source="auteur.nom_complet", read_only=True, default="")
    etat_libelle = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = Proposition
        fields = ["id", "de_l_equipe", "auteur_nom", "prix_m2", "montant_total", "delai_jours", "message", "etat",
                  "etat_libelle", "cree_le"]
        read_only_fields = ["de_l_equipe", "etat", "cree_le"]

    def validate(self, donnees):
        if not any(donnees.get(c) for c in ("prix_m2", "montant_total", "message")):
            raise serializers.ValidationError("Indiquez un prix, un montant ou un message.")
        return donnees


class HistoriqueSerializer(serializers.ModelSerializer):
    nouveau_libelle = serializers.CharField(source="get_nouveau_display", read_only=True)
    par_nom = serializers.CharField(source="par.nom_complet", read_only=True, default="")

    class Meta:
        model = HistoriqueStatut
        fields = ["nouveau", "nouveau_libelle", "par_nom", "cree_le"]


class CommandeSerializer(serializers.ModelSerializer):
    """Vue du client (BF-10, BF-12, BF-13)."""

    lignes = LigneCommandeSerializer(many=True, required=False)
    propositions = PropositionSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    type_batiment_libelle = serializers.CharField(source="get_type_batiment_display", read_only=True)
    surface_totale = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    etapes = serializers.SerializerMethodField()
    conversation = serializers.IntegerField(source="conversation.id", read_only=True, default=None)

    class Meta:
        model = Commande
        fields = ["id", "numero", "statut", "statut_libelle", "etapes", "type_batiment", "type_batiment_libelle",
                  "ville", "quartier", "rue_repere", "date_souhaitee", "message", "sur_mesure", "lignes",
                  "surface_totale", "montant_convenu", "propositions", "conversation", "cree_le", "modifie_le"]
        read_only_fields = ["numero", "statut", "montant_convenu", "cree_le", "modifie_le"]
        extra_kwargs = {"ville": {"required": False}, "quartier": {"required": False},
                        "rue_repere": {"required": False}, "type_batiment": {"required": False}}

    def get_etapes(self, commande):
        index = commande.index_etape
        return [{"code": e.value, "libelle": e.label, "faite": i < index, "en_cours": i == index}
                for i, e in enumerate(ETAPES)]


class CommandeListeSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    type_batiment_libelle = serializers.CharField(source="get_type_batiment_display", read_only=True)
    client_nom = serializers.CharField(source="client.nom_complet", read_only=True)
    produit_principal = serializers.SerializerMethodField()
    vignette = serializers.SerializerMethodField()
    surface_totale = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    non_lus = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Commande
        fields = ["id", "numero", "statut", "statut_libelle", "type_batiment", "type_batiment_libelle", "ville",
                  "quartier", "client_nom", "produit_principal", "vignette", "surface_totale", "sur_mesure",
                  "non_lus", "cree_le"]

    def _premiere_ligne(self, commande):
        lignes = list(commande.lignes.all())
        return lignes[0] if lignes else None

    def get_produit_principal(self, commande):
        ligne = self._premiere_ligne(commande)
        if not ligne:
            return "Design sur mesure" if commande.sur_mesure else ""
        reste = len(commande.lignes.all()) - 1
        return ligne.produit.nom + (f" + {reste}" if reste else "")

    def get_vignette(self, commande):
        ligne = self._premiere_ligne(commande)
        image = ligne.produit.images.first() if ligne else None
        if not image:
            return None
        requete = self.context.get("request")
        return requete.build_absolute_uri(image.image.url) if requete else image.image.url


class CommandeAdminSerializer(CommandeSerializer):
    """Vue de l'équipe (BF-16) : coordonnées du client, note interne, historique."""

    client = serializers.SerializerMethodField()
    historique = HistoriqueSerializer(many=True, read_only=True)

    class Meta(CommandeSerializer.Meta):
        fields = CommandeSerializer.Meta.fields + ["client", "note_interne", "historique"]
        read_only_fields = ["numero", "cree_le", "modifie_le"]

    def get_client(self, commande):
        c = commande.client
        return {"id": c.id, "nom_complet": c.nom_complet, "email": c.email, "telephone": c.telephone,
                "type_client": c.type_client, "initiales": c.initiales}

    def validate_statut(self, valeur):
        if valeur not in Statut.values:
            raise serializers.ValidationError("Statut inconnu.")
        return valeur
