from rest_framework.test import APITestCase

from apps.accounts.models import Adresse, User
from apps.catalog.models import Famille, Produit
from apps.messaging.models import Message

from .models import Commande, Statut


class ParcoursCommandeTests(APITestCase):
    def setUp(self):
        famille = Famille.objects.create(nom="Finitions")
        self.produit = Produit.objects.create(nom="Sol autolissant époxy", famille=famille)
        self.client_cir = User.objects.create_user("client@test.cm", "Mot-de-passe-1", nom_complet="Client Test")
        self.equipe = User.objects.create_user("equipe@test.cm", "Mot-de-passe-1", nom_complet="Équipe",
                                               is_staff=True)

    def connecter(self, utilisateur):
        self.client.force_authenticate(utilisateur)

    def test_commande_refusee_sans_adresse(self):
        """Règle de gestion : pas de commande sans adresse."""
        self.connecter(self.client_cir)
        r = self.client.post("/api/commandes/", {"lignes": [{"produit": self.produit.slug, "surface_m2": 40}]},
                             format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("adresse", r.data)

    def test_parcours_complet(self):
        Adresse.objects.create(utilisateur=self.client_cir, ville="Douala", quartier="Akwa", rue_repere="Rue 1")
        self.connecter(self.client_cir)
        self.client.post("/api/selection/", {"produit": self.produit.slug, "surface_m2": "40"}, format="json")
        r = self.client.post("/api/commandes/", {"message": "Salon"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        numero = r.data["numero"]
        self.assertEqual(r.data["lignes"][0]["produit"], self.produit.slug)  # repris de la sélection
        self.assertTrue(r.data["conversation"])

        # L'équipe propose un prix : la commande passe en négociation
        self.connecter(self.equipe)
        r = self.client.post(f"/api/admin/commandes/{numero}/propositions/", {"prix_m2": 10000}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["statut"], Statut.NEGOCIATION)
        proposition = r.data["propositions"][-1]
        self.assertEqual(int(proposition["montant_total"]), 400000)

        # Le client accepte : contrat signé
        self.connecter(self.client_cir)
        r = self.client.post(f"/api/commandes/{numero}/propositions/{proposition['id']}/accepter/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["statut"], Statut.CONTRAT_SIGNE)
        self.assertEqual(int(r.data["montant_convenu"]), 400000)
        self.assertTrue(Message.objects.filter(est_systeme=True).exists())

    def test_client_ne_voit_pas_les_commandes_des_autres(self):
        Adresse.objects.create(utilisateur=self.client_cir, ville="Douala", quartier="Akwa", rue_repere="Rue 1")
        autre = User.objects.create_user("autre@test.cm", "Mot-de-passe-1", nom_complet="Autre")
        commande = Commande.objects.create(client=self.client_cir, ville="Douala", quartier="A", rue_repere="R")
        self.connecter(autre)
        self.assertEqual(self.client.get(f"/api/commandes/{commande.numero}/").status_code, 404)

    def test_api_admin_interdite_aux_clients(self):
        self.connecter(self.client_cir)
        self.assertEqual(self.client.get("/api/admin/commandes/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/statistiques/").status_code, 403)
