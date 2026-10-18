"""Outils communs aux tests de la vague 2 (selection, commandes, devis, contact)."""
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.catalogue.models import Design, Famille, Produit
from apps.catalogue.tests.outils import ADRESSE, MDP, MediasTemporairesMixin, creer_client, creer_membre, image_png  # noqa: F401
from apps.comptes.models import Utilisateur
from apps.commandes import services


def creer_client_sans_adresse(email="sansadresse@exemple.cm"):
    return Utilisateur.objects.create_user(email, MDP, nom_complet="Sans Adresse", ville="Douala")


def creer_commande(client, produit, **donnees):
    """Crée une commande par le service (règles comprises) ; `donnees` complète ou remplace les valeurs de base."""
    base = {"type_batiment": "maison", "surface_m2": None, "description": "",
            "lignes": [{"produit": produit.pk, "design": None}]}
    return services.creer_commande(client, {**base, **donnees})


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])  # tests plus rapides
class BaseVague2(MediasTemporairesMixin, APITestCase):
    """Catalogue minimal, deux clients, un membre de l'équipe. Aucune donnée de démonstration en base."""

    def setUp(self):
        super().setUp()
        self.famille = Famille.objects.create(nom="Finitions", traductions={"en": {"nom": "Finishes"}})
        self.produit = Produit.objects.create(famille=self.famille, nom="Sol autolissant", reference="YD-500",
                                              traductions={"en": {"nom": "Self-levelling floor"}})
        self.design = Design.objects.create(produit=self.produit, nom="Gris", couleur="#808080",
                                            traductions={"en": {"nom": "Grey"}})
        self.autre_produit = Produit.objects.create(famille=self.famille, nom="Primaire", reference="YD-103")
        self.hors_ligne = Produit.objects.create(famille=self.famille, nom="Hors ligne", en_ligne=False)
        self.client_a = creer_client("a@exemple.cm", "Alice Client")
        self.client_b = creer_client("b@exemple.cm", "Bruno Client")
        self.membre = creer_membre()

    def se_connecter(self, utilisateur):
        self.client.force_authenticate(utilisateur)
