from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import Famille


class CatalogueTests(APITestCase):
    def test_plan_de_coupe(self):
        """BF-06 : les couches saisies dans le dashboard apparaissent sur la fiche produit, dans l'ordre."""
        self.client.force_authenticate(User.objects.create_user("e@test.cm", "Bon-Mot-De-Passe-1",
                                                                nom_complet="E", is_staff=True))
        famille = Famille.objects.create(nom="Finitions")
        r = self.client.post("/api/admin/catalogue/produits/", {
            "nom": "Sol autolissant", "famille": famille.id, "en_ligne": True,
            "couches": [{"nom": "Finition YD-500", "epaisseur": "2 mm"}, {"nom": "Primaire YD-103", "epaisseur": ""}],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)

        self.client.force_authenticate(None)
        fiche = self.client.get(f"/api/catalogue/produits/{r.data['slug']}/").data
        self.assertEqual([c["nom"] for c in fiche["couches"]], ["Finition YD-500", "Primaire YD-103"])
