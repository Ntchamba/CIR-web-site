"""Tests de fumée des comptes (la suite complète est écrite par backend-testeur)."""
from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role

MDP = "Resine-Epoxy-2026!"
INSCRIPTION = {
    "email": "Awa@Exemple.cm", "mot_de_passe": MDP, "nom_complet": "Awa Test",
    "ville": "Douala", "quartier": "Bonapriso", "rue_ou_repere": "Près de la pharmacie",
}


class ComptesFumeeTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_inscription_connexion_profil(self):
        r = self.client.post("/api/comptes/inscription/", INSCRIPTION, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["utilisateur"]["email"], "awa@exemple.cm")
        self.assertTrue(r.data["utilisateur"]["adresse_complete"])
        self.assertIn("acces", r.data)

        r = self.client.post("/api/comptes/connexion/", {"email": "AWA@exemple.cm", "mot_de_passe": MDP},
                             format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['acces']}")
        rafraichissement = r.data["rafraichissement"]

        r = self.client.patch("/api/comptes/moi/", {"quartier": "Akwa", "role": "super_admin"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["quartier"], "Akwa")
        self.assertEqual(r.data["role"], Role.CLIENT)

        r = self.client.patch("/api/comptes/moi/", {"ville": "  "}, format="json")
        self.assertEqual(r.status_code, 400)

        r = self.client.post("/api/comptes/connexion/rafraichir/", {"rafraichissement": rafraichissement},
                             format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn("acces", r.data)

    def test_inscription_sans_adresse_refusee(self):
        donnees = {**INSCRIPTION, "quartier": ""}
        r = self.client.post("/api/comptes/inscription/", donnees, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Utilisateur.objects.exists())

    def test_blocage_apres_cinq_echecs(self):
        Utilisateur.objects.create_user("b@exemple.cm", MDP, nom_complet="B")
        for _ in range(5):
            r = self.client.post("/api/comptes/connexion/", {"email": "b@exemple.cm", "mot_de_passe": "faux"},
                                 format="json")
            self.assertEqual(r.status_code, 401)
        r = self.client.post("/api/comptes/connexion/", {"email": "b@exemple.cm", "mot_de_passe": MDP},
                             format="json")
        self.assertEqual(r.status_code, 429)


class EquipeFumeeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = Utilisateur.objects.create_superuser("admin@cir.cm", MDP, nom_complet="Admin")
        self.membre = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="Membre", role=Role.MEMBRE)
        self.client_cir = Utilisateur.objects.create_user("c@exemple.cm", MDP, nom_complet="Client")

    def test_roles_et_drapeaux(self):
        self.assertTrue(self.admin.is_staff and self.admin.is_superuser)
        self.assertTrue(self.membre.is_staff and not self.membre.is_superuser)
        self.assertFalse(self.client_cir.is_staff)

    def test_gestion_equipe_reservee_super_admin(self):
        self.client.force_authenticate(self.membre)
        self.assertEqual(self.client.get("/api/admin/comptes/equipe/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/comptes/clients/").status_code, 200)

        self.client.force_authenticate(self.client_cir)
        self.assertEqual(self.client.get("/api/admin/comptes/clients/").status_code, 403)

        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/admin/comptes/equipe/", {
            "email": "nouveau@cir.cm", "nom_complet": "Nouveau", "mot_de_passe": MDP}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["role"], Role.MEMBRE)
        r = self.client.post(f"/api/admin/comptes/equipe/{r.data['id']}/desactiver/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["actif"])
        r = self.client.post(f"/api/admin/comptes/equipe/{self.admin.pk}/desactiver/")
        self.assertEqual(r.status_code, 400)

        r = self.client.get("/api/admin/comptes/equipe/")
        self.assertEqual(r.data["count"], 3)

    def test_connexion_equipe_refuse_client(self):
        r = self.client.post("/api/admin/comptes/connexion/", {"email": "c@exemple.cm", "mot_de_passe": MDP},
                             format="json")
        self.assertEqual(r.status_code, 403)
        r = self.client.post("/api/admin/comptes/connexion/", {"email": "m@cir.cm", "mot_de_passe": MDP},
                             format="json")
        self.assertEqual(r.status_code, 200)
