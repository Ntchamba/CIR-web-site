"""API de la sélection (/api/selection/) : isolation, plafond, disponibilité, langues, requêtes."""
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.commandes.tests.outils import BaseVague2, image_png
from apps.catalogue.models import Design, ImageProduit
from apps.selection.models import ElementSelection

URL = "/api/selection/"


class SelectionApiTests(BaseVague2):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.client_a)

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.client.force_authenticate(self.membre)
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "compte_equipe")
        self.assertEqual(self.client.post(URL, {"produit": self.produit.pk}, format="json").status_code, 403)

    def test_ajout_liste_et_resume(self):
        ImageProduit.objects.create(produit=self.produit, image=image_png(), alt="")
        r = self.client.post(URL, {"produit": self.produit.pk, "design": self.design.pk}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(set(r.data), {"id", "produit", "design", "ajoute_le", "disponible"})
        self.assertEqual(r.data["produit"]["famille"], {"slug": "finitions", "nom": "Finitions"})
        self.assertTrue(r.data["produit"]["image"]["url"].startswith("http://testserver/media/"))
        self.assertEqual(r.data["design"], {"id": self.design.pk, "nom": "Gris", "couleur": "#808080", "image": None})
        self.assertIsNone(r.data["produit"]["prix"])
        self.assertTrue(r.data["disponible"])
        # même élément : 200, pas de doublon
        r = self.client.post(URL, {"produit": self.produit.pk, "design": self.design.pk}, format="json")
        self.assertEqual(r.status_code, 200)
        # le même produit sans design est un autre élément ; doublon sans design aussi
        self.assertEqual(self.client.post(URL, {"produit": self.produit.pk}, format="json").status_code, 201)
        self.assertEqual(self.client.post(URL, {"produit": self.produit.pk}, format="json").status_code, 200)
        liste = self.client.get(URL).data
        self.assertEqual(liste["count"], 2)
        self.assertEqual(len(liste["elements"]), 2)
        resume = self.client.get(f"{URL}resume/").data
        self.assertEqual(resume, {"count": 1, "produits": [self.produit.pk]})

    def test_ajout_refuse(self):
        autre_design = Design.objects.create(produit=self.autre_produit, nom="Bleu")
        cas = [({"produit": self.hors_ligne.pk}, "produit"), ({"produit": 99999}, "produit"),
               ({"produit": self.produit.pk, "design": autre_design.pk}, "design"),
               ({"produit": self.produit.pk, "design": 99999}, "design"), ({}, "produit")]
        for donnees, champ in cas:
            with self.subTest(donnees=donnees):
                r = self.client.post(URL, donnees, format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn(champ, r.data)
        self.assertEqual(ElementSelection.objects.count(), 0)

    def test_plafond_de_cinquante_elements(self):
        from apps.catalogue.models import Produit
        for i in range(50):
            produit = Produit.objects.create(famille=self.famille, nom=f"P{i}")
            ElementSelection.objects.create(utilisateur=self.client_a, produit=produit)
        r = self.client.post(URL, {"produit": self.produit.pk}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("detail", r.data)
        # un élément déjà présent reste ajoutable (200) même à 50
        premier = ElementSelection.objects.first().produit
        self.assertEqual(self.client.post(URL, {"produit": premier.pk}, format="json").status_code, 200)

    def test_produit_passe_hors_ligne_reste_visible_mais_indisponible(self):
        self.client.post(URL, {"produit": self.produit.pk}, format="json")
        self.produit.en_ligne = False
        self.produit.save()
        element = self.client.get(URL).data["elements"][0]
        self.assertFalse(element["disponible"])

    def test_retirer_et_vider_isolation(self):
        mien = ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)
        autre = ElementSelection.objects.create(utilisateur=self.client_b, produit=self.produit)
        self.assertEqual(self.client.delete(f"{URL}{autre.pk}/").status_code, 404)
        self.assertTrue(ElementSelection.objects.filter(pk=autre.pk).exists())
        self.assertEqual(self.client.delete(f"{URL}{mien.pk}/").status_code, 204)
        ElementSelection.objects.create(utilisateur=self.client_a, produit=self.autre_produit)
        self.assertEqual(self.client.delete(URL).status_code, 204)
        self.assertEqual(ElementSelection.objects.filter(utilisateur=self.client_a).count(), 0)
        self.assertEqual(ElementSelection.objects.filter(utilisateur=self.client_b).count(), 1)
        self.assertEqual(self.client.get(URL).data, {"count": 0, "elements": []})

    def test_noms_dans_la_langue_de_la_requete(self):
        self.client.post(URL, {"produit": self.produit.pk, "design": self.design.pk}, format="json")
        element = self.client.get(URL, HTTP_ACCEPT_LANGUAGE="en").data["elements"][0]
        self.assertEqual(element["produit"]["nom"], "Self-levelling floor")
        self.assertEqual(element["produit"]["famille"]["nom"], "Finishes")
        self.assertEqual(element["design"]["nom"], "Grey")
        r = self.client.post(URL, {"produit": self.hors_ligne.pk}, format="json", HTTP_ACCEPT_LANGUAGE="de")
        self.assertEqual(r.data["produit"][0], "Dieses Produkt ist nicht verfügbar.")

    def test_pas_de_requete_par_element(self):
        produits = []
        from apps.catalogue.models import Produit
        for i in range(8):
            p = Produit.objects.create(famille=self.famille, nom=f"P{i}")
            ImageProduit.objects.create(produit=p, image=image_png(), alt="")
            d = Design.objects.create(produit=p, nom="d")
            ElementSelection.objects.create(utilisateur=self.client_a, produit=p, design=d)
        with CaptureQueriesContext(connection) as ctx:
            r = self.client.get(URL)
        self.assertEqual(r.data["count"], 8)
        self.assertLessEqual(len(ctx), 6)
