"""Devis (BF-11, BF-12) : demande de rendu sur mesure, devis chiffré joint à une commande, ses lignes.

Le contenu écrit par les clients et l'équipe (descriptions, notes, réponses) n'est pas traduit. Les montants du
devis se calculent dans `calcul.py` (jamais stockés : ils se déduisent des lignes).
"""
from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.commandes.models import TypeBatiment
from apps.noyau.images import TAILLES, ImagesOptimiseesMixin
from apps.noyau.references import ReferenceMixin

from . import calcul
from .calcul import TypeLigne


class EtatDemande(models.TextChoices):
    NOUVELLE = "nouvelle", _("Nouvelle")
    EN_ETUDE = "en_etude", _("En étude")
    DEVIS_ENVOYE = "devis_envoye", _("Devis envoyé")
    CLOSE = "close", _("Clôturée")


class DemandeRendu(ReferenceMixin, models.Model):
    """Demande de rendu sur mesure : le client décrit son projet (et joint des photos) ; l'équipe répond par un devis."""

    prefixe_reference = "REN"

    reference = models.CharField("référence", max_length=20, unique=True, editable=False)  # REN-2026-0001
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="demandes_rendu")
    description = models.TextField(max_length=1500)
    type_batiment = models.CharField("type de bâtiment", max_length=12, choices=TypeBatiment.choices)
    surface_m2 = models.DecimalField("surface (m²)", max_digits=10, decimal_places=2, null=True, blank=True)
    produit = models.ForeignKey("catalogue.Produit", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="+", verbose_name="produit de référence")
    commande = models.ForeignKey("commandes.Commande", on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="demandes_rendu")
    etat = models.CharField("état", max_length=14, choices=EtatDemande.choices, default=EtatDemande.NOUVELLE,
                            db_index=True)
    reponse_equipe = models.TextField("réponse de l'équipe", blank=True)
    notes_internes = models.TextField("notes internes", blank=True)  # équipe seulement
    cree_le = models.DateTimeField("créée le", auto_now_add=True)
    modifie_le = models.DateTimeField("modifiée le", auto_now=True)

    class Meta:
        verbose_name = "demande de rendu"
        verbose_name_plural = "demandes de rendu"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return self.reference


class ImageDemande(ImagesOptimiseesMixin, models.Model):
    """Photo jointe à une demande de rendu (WebP 1280 px) ; 5 au plus par demande."""

    champs_images = {"image": TAILLES["moyenne"] + 320}

    demande = models.ForeignKey(DemandeRendu, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="devis/demandes/")
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "image de demande"
        verbose_name_plural = "images de demande"
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.demande_id} ({self.ordre})"


class EtatDevis(models.TextChoices):
    BROUILLON = "brouillon", _("Brouillon")
    ENVOYE = "envoye", _("Envoyé")
    ACCEPTE = "accepte", _("Accepté")
    REFUSE = "refuse", _("Refusé")
    REMPLACE = "remplace", _("Remplacé")


# Ce que le client voit : jamais les brouillons
ETATS_VISIBLES_CLIENT = (EtatDevis.ENVOYE, EtatDevis.ACCEPTE, EtatDevis.REFUSE, EtatDevis.REMPLACE)


class Devis(ReferenceMixin, models.Model):
    prefixe_reference = "DEV"

    reference = models.CharField("référence", max_length=20, unique=True, editable=False)  # DEV-2026-0001
    commande = models.ForeignKey("commandes.Commande", on_delete=models.PROTECT, related_name="devis")
    demande = models.ForeignKey(DemandeRendu, on_delete=models.SET_NULL, null=True, blank=True, related_name="devis")
    etat = models.CharField("état", max_length=10, choices=EtatDevis.choices, default=EtatDevis.BROUILLON,
                            db_index=True)
    validite_jours = models.PositiveIntegerField("validité (jours)", default=30,
                                                 validators=[MinValueValidator(1), MaxValueValidator(365)])
    notes = models.TextField(max_length=1000, blank=True)
    envoye_le = models.DateTimeField("envoyé le", null=True, blank=True)
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="+")
    cree_le = models.DateTimeField("créé le", auto_now_add=True)
    modifie_le = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "devis"
        verbose_name_plural = "devis"
        ordering = ["-cree_le", "-id"]

    def __str__(self):
        return self.reference

    @property
    def valide_jusqu_au(self):
        """Dernier jour de validité (date de Douala), ou None tant que le devis n'est pas envoyé."""
        if self.envoye_le is None:
            return None
        return timezone.localtime(self.envoye_le).date() + timedelta(days=self.validite_jours)

    @property
    def expire(self):
        """Vrai si le devis est envoyé (sans réponse) et sa date de validité est passée."""
        limite = self.valide_jusqu_au
        return self.etat == EtatDevis.ENVOYE and limite is not None and timezone.localdate() > limite

    def resultat(self):
        """Calcul de tout le devis (lignes préchargées : aucune requête en plus)."""
        return calcul.calculer([ligne.donnees_calcul() for ligne in self.lignes.all()])

    @property
    def total(self):
        return self.resultat().total


class LigneDevis(models.Model):
    devis = models.ForeignKey(Devis, on_delete=models.CASCADE, related_name="lignes")
    ordre = models.PositiveIntegerField(default=0)
    type_ligne = models.CharField(max_length=10, choices=TypeLigne.choices)
    libelle = models.CharField("libellé", max_length=160, blank=True)  # vide avec produit : nom du produit
    produit = models.ForeignKey("catalogue.Produit", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="+")
    surface_m2 = models.DecimalField("surface (m²)", max_digits=10, decimal_places=2, null=True, blank=True)
    dosage_kg_m2 = models.DecimalField("dosage (kg/m²)", max_digits=8, decimal_places=3, null=True, blank=True)
    prix_kg = models.PositiveIntegerField("prix au kg (FCFA)", null=True, blank=True)
    prix_m2 = models.PositiveIntegerField("prix au m² (FCFA)", null=True, blank=True)
    montant_forfait = models.PositiveIntegerField("montant du forfait (FCFA)", null=True, blank=True)

    class Meta:
        verbose_name = "ligne de devis"
        verbose_name_plural = "lignes de devis"
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.devis_id} : {self.libelle}"

    def donnees_calcul(self):
        return {"type_ligne": self.type_ligne, "surface_m2": self.surface_m2, "dosage_kg_m2": self.dosage_kg_m2,
                "prix_kg": self.prix_kg, "prix_m2": self.prix_m2, "montant_forfait": self.montant_forfait}

    @property
    def resultat(self):
        return calcul.calculer_ligne(self.donnees_calcul())

    @property
    def libelle_affiche(self):
        """Libellé saisi, sinon le nom (traduit) du produit lié."""
        if self.libelle:
            return self.libelle
        return self.produit.traduit("nom") if self.produit_id else ""
