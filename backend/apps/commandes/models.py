"""Commandes (BF-10, BF-12, BF-13, BF-16) : commande, lignes, propositions de la négociation, historique des étapes.

Le contenu écrit par les clients et l'équipe (description, messages, motifs, notes) n'est pas traduit.
"""
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.noyau.references import ReferenceMixin

from .etapes import Etat, Role


class TypeBatiment(models.TextChoices):
    MAISON = "maison", _("Maison")
    INDUSTRIE = "industrie", _("Industrie")
    ENTREPRISE = "entreprise", _("Entreprise")


class Commande(ReferenceMixin, models.Model):
    prefixe_reference = "CIR"

    reference = models.CharField("référence", max_length=20, unique=True, editable=False)  # CIR-2026-0001
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="commandes")
    type_batiment = models.CharField("type de bâtiment", max_length=12, choices=TypeBatiment.choices)
    etat = models.CharField("étape", max_length=15, choices=Etat.choices, default=Etat.NOUVELLE, db_index=True)
    # Adresse du chantier : instantané de l'adresse du client à la création
    ville = models.CharField(max_length=80)
    quartier = models.CharField(max_length=80)
    rue_ou_repere = models.CharField("rue ou repère", max_length=200)
    surface_m2 = models.DecimalField("surface (m²)", max_digits=10, decimal_places=2, null=True, blank=True,
                                     validators=[MinValueValidator(0)])
    description = models.TextField(max_length=1500, blank=True)
    # Fixés à l'acceptation d'une proposition
    montant_convenu = models.PositiveIntegerField("montant convenu (FCFA)", null=True, blank=True)
    prix_m2_convenu = models.PositiveIntegerField("prix au m² convenu (FCFA)", null=True, blank=True)
    delai_convenu_jours = models.PositiveIntegerField("délai convenu (jours)", null=True, blank=True)
    signe_le = models.DateTimeField("signé le", null=True, blank=True)
    # Somme déjà encaissée (FCFA) : modifiée uniquement par apps/paiements/services.py, dans la transaction de l'encaissement
    montant_paye = models.PositiveIntegerField("montant payé (FCFA)", default=0)
    notes_internes = models.TextField("notes internes", blank=True)  # équipe seulement, jamais envoyées au client
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    modifie_le = models.DateTimeField("modifiée le", auto_now=True)

    class Meta:
        verbose_name = "commande"
        verbose_name_plural = "commandes"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return self.reference


class LigneCommande(models.Model):
    """Produit (et design) demandé ; le nom est conservé en français pour garder l'historique si le catalogue change."""

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="lignes")
    produit = models.ForeignKey("catalogue.Produit", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="+")
    design = models.ForeignKey("catalogue.Design", on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="+")
    produit_nom = models.CharField(max_length=160, blank=True)
    produit_reference = models.CharField(max_length=30, blank=True)
    design_nom = models.CharField(max_length=120, blank=True)

    class Meta:
        verbose_name = "ligne de commande"
        verbose_name_plural = "lignes de commande"
        ordering = ["id"]

    def __str__(self):
        return f"{self.commande_id} : {self.produit_nom}"


class EtatProposition(models.TextChoices):
    EN_ATTENTE = "en_attente", _("En attente")
    ACCEPTEE = "acceptee", _("Acceptée")
    REFUSEE = "refusee", _("Refusée")
    REMPLACEE = "remplacee", _("Remplacée")


class Proposition(models.Model):
    """Proposition ou contre-proposition de la négociation. Une seule est « en attente » à la fois."""

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="propositions")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    auteur_role = models.CharField(max_length=10, choices=Role.choices)
    prix_m2 = models.PositiveIntegerField("prix au m² (FCFA)", null=True, blank=True)
    total = models.PositiveIntegerField("total (FCFA)", null=True, blank=True)
    delai_jours = models.PositiveIntegerField("délai (jours)", null=True, blank=True,
                                              validators=[MinValueValidator(1)])
    message = models.TextField(max_length=1000, blank=True)
    etat = models.CharField(max_length=12, choices=EtatProposition.choices, default=EtatProposition.EN_ATTENTE,
                            db_index=True)
    reponse = models.TextField("message de réponse", max_length=1000, blank=True)  # accepter / refuser {message}
    devis = models.ForeignKey("devis.Devis", on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="propositions")
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    repondu_le = models.DateTimeField("répondue le", null=True, blank=True)

    class Meta:
        verbose_name = "proposition"
        verbose_name_plural = "propositions"
        ordering = ["cree_le", "id"]
        constraints = [
            models.UniqueConstraint(fields=["commande"], condition=models.Q(etat="en_attente"),
                                    name="commandes_une_proposition_en_attente"),
        ]

    def __str__(self):
        return f"{self.commande_id} : {self.auteur_role} {self.etat}"


class ChangementEtat(models.Model):
    """Historique des étapes : une ligne par changement (règle 7)."""

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="historique")
    de = models.CharField(max_length=15, choices=Etat.choices)
    vers = models.CharField(max_length=15, choices=Etat.choices)
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="+")
    auteur_role = models.CharField(max_length=10, choices=Role.choices)
    motif = models.CharField(max_length=500, blank=True)
    cree_le = models.DateTimeField("le", auto_now_add=True)

    class Meta:
        verbose_name = "changement d'étape"
        verbose_name_plural = "changements d'étape"
        ordering = ["cree_le", "id"]

    def __str__(self):
        return f"{self.commande_id} : {self.de} → {self.vers}"
