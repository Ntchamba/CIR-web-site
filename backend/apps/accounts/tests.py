from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import User


class ComptesTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_inscription_puis_connexion(self):
        r = self.client.post("/api/comptes/inscription/", {
            "email": "Nouveau@Test.cm", "password": "Un-Mot-De-Passe-Solide", "nom_complet": "Nouveau Client",
            "adresse": {"ville": "Douala", "quartier": "Bonamoussadi", "rue_repere": "Carrefour"}}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["a_une_adresse"])
        utilisateur = User.objects.get(email="nouveau@test.cm")
        self.assertNotEqual(utilisateur.password, "Un-Mot-De-Passe-Solide")  # haché (BNF-06)

        r = self.client.post("/api/comptes/connexion/", {"email": "nouveau@test.cm",
                                                         "password": "Un-Mot-De-Passe-Solide"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_blocage_apres_cinq_essais(self):
        User.objects.create_user("a@test.cm", "Bon-Mot-De-Passe-1", nom_complet="A")
        for _ in range(5):
            r = self.client.post("/api/comptes/connexion/", {"email": "a@test.cm", "password": "faux"})
            self.assertEqual(r.status_code, 401)
        r = self.client.post("/api/comptes/connexion/", {"email": "a@test.cm", "password": "Bon-Mot-De-Passe-1"})
        self.assertEqual(r.status_code, 429)

    def test_dashboard_refuse_un_client(self):
        User.objects.create_user("c@test.cm", "Bon-Mot-De-Passe-1", nom_complet="C")
        r = self.client.post("/api/admin/comptes/connexion/", {"email": "c@test.cm", "password": "Bon-Mot-De-Passe-1"})
        self.assertEqual(r.status_code, 400)
