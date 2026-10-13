from django.conf import settings
from django.db import models
from django.db.models import Sum

from apps.accounts.models import TypeBatiment


class Statut(models.TextChoices):
    """Étapes d'une commande, dans l'ordre (BF-13)."""

    NOUVELLE = "nouvelle", "Nouvelle"
    NEGOCIATION = "negociation", "En négociation"
    CONTRAT_SIGNE = "contrat_signe", "Contrat signé"
    TRAVAUX = "travaux", "Travaux en cours"
    TERMINEE = "terminee", "Terminée"
    ANNULEE = "annulee", "Annulée"


ETAPES = [Statut.NOUVELLE, Statut.NEGOCIATION, Statut.CONTRAT_SIGNE, Statut.TRAVAUX, Statut.TERMINEE]


class Commande(models.Model):
    """BF-10 : commande passée à partir de la sélection, pour une maison, une industrie ou une entreprise."""

    numero = models.CharField("numéro", max_length=20, unique=True, blank=True)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="commandes")
    type_batiment = models.CharField(max_length=20, choices=TypeBatiment.choices, default=TypeBatiment.MAISON)

    # Adresse du chantier (reprise de l'adresse du client, modifiable)
    ville = models.CharField(max_length=80)
    quartier = models.CharField(max_length=80)
    rue_repere = models.CharField("rue ou repère", max_length=200)

    date_souhaitee = models.DateField("date souhaitée", null=True, blank=True)
    message = models.TextField("description du projet", blank=True)
    sur_mesure = models.BooleanField("demande de rendu particulier", default=False)

    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.NOUVELLE)
    montant_convenu = models.DecimalField(max_digits=14, decimal_places=0, null=True, blank=True)
    note_interne = models.TextField("note interne (jamais visible par le client)", blank=True)

    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"Commande {self.pk}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.numero:
            self.numero = f"CIR-{1000 + self.pk}"
            super().save(update_fields=["numero"])

    @property
    def surface_totale(self):
        return self.lignes.aggregate(total=Sum("surface_m2"))["total"] or 0

    @property
    def index_etape(self):
        return ETAPES.index(self.statut) if self.statut in ETAPES else -1


class LigneCommande(models.Model):
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="lignes")
    produit = models.ForeignKey("catalog.Produit", on_delete=models.PROTECT, related_name="lignes_commande")
    surface_m2 = models.DecimalField("surface (m²)", max_digits=10, decimal_places=2, null=True, blank=True)
    teinte = models.CharField("teinte souhaitée", max_length=80, blank=True)
    remarque = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["id"]


class Proposition(models.Model):
    """BF-12 : offre de prix et de délai, faite par l'équipe ou par le client (contre-proposition)."""

    class Etat(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente de réponse"
        ACCEPTEE = "acceptee", "Acceptée"
        REFUSEE = "refusee", "Refusée"
        REMPLACEE = "remplacee", "Remplacée"

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="propositions")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
                               related_name="propositions")
    de_l_equipe = models.BooleanField(default=False)
    prix_m2 = models.DecimalField("prix au m²", max_digits=12, decimal_places=0, null=True, blank=True)
    montant_total = models.DecimalField(max_digits=14, decimal_places=0, null=True, blank=True)
    delai_jours = models.PositiveIntegerField("délai d'intervention (jours)", null=True, blank=True)
    message = models.TextField(blank=True)
    etat = models.CharField(max_length=12, choices=Etat.choices, default=Etat.EN_ATTENTE)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cree_le"]


class HistoriqueStatut(models.Model):
    """Trace de chaque changement d'étape (qui, quand)."""

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="historique")
    ancien = models.CharField(max_length=20, choices=Statut.choices, blank=True)
    nouveau = models.CharField(max_length=20, choices=Statut.choices)
    par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cree_le"]
