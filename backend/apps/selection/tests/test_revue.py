"""Revue du testeur (vague 2) : sélection, accès et bornes."""
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.catalogue.models import Design
from apps.commandes.tests.outils import BaseVague2
from apps.selection.models import ElementSelection

URL = "/api/selection/"


class SelectionRevueTests(BaseVague2):
    def test_acces_visiteur_et_equipe_sur_toutes_les_routes(self):
        e = ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)
        chemins = [("get", URL), ("get", f"{URL}resume/"), ("post", URL), ("delete", URL),
                   ("delete", f"{URL}{e.pk}/")]
        for qui, code in ((None, 401), (self.membre, 403)):
            self.client.force_authenticate(qui)
            for methode, chemin in chemins:
                with self.subTest(qui=str(qui), chemin=chemin, methode=methode):
                    r = getattr(self.client, methode)(chemin, {"produit": self.produit.pk}, format="json")
                    self.assertEqual(r.status_code, code)
        self.assertEqual(ElementSelection.objects.count(), 1)

    def test_methodes_non_prevues(self):
        self.se_connecter(self.client_a)
        e = ElementSelection.objects.create(utilisateur=self.client_a, produit=self.produit)
        self.assertEqual(self.client.patch(f"{URL}{e.pk}/", {}, format="json").status_code, 405)
        self.assertEqual(self.client.put(URL, {}, format="json").status_code, 405)
        self.assertEqual(self.client.get(f"{URL}{e.pk}/").status_code, 405)

    def test_formes_invalides(self):
        self.se_connecter(self.client_a)
        autre = Design.objects.create(produit=self.autre_produit, nom="Bleu", couleur="#00f")
        cas = [{}, {"produit": None}, {"produit": "abc"}, {"produit": 999999}, {"produit": self.hors_ligne.pk},
               {"produit": self.produit.pk, "design": 999999}, {"produit": self.produit.pk, "design": "x"},
               {"produit": self.produit.pk, "design": autre.pk}, {"produit": [self.produit.pk]}]
        for corps in cas:
            with self.subTest(corps=str(corps)):
                self.assertEqual(self.client.post(URL, corps, format="json").status_code, 400)
        self.assertEqual(ElementSelection.objects.count(), 0)

    def test_ajout_repete_et_designs_distincts(self):
        self.se_connecter(self.client_a)
        d2 = Design.objects.create(produit=self.produit, nom="Blanc", couleur="#fff")
        codes = [self.client.post(URL, c, format="json").status_code for c in (
            {"produit": self.produit.pk}, {"produit": self.produit.pk}, {"produit": self.produit.pk, "design": None},
            {"produit": self.produit.pk, "design": self.design.pk},
            {"produit": self.produit.pk, "design": self.design.pk}, {"produit": self.produit.pk, "design": d2.pk})]
        self.assertEqual(codes, [201, 200, 200, 201, 200, 201])
        self.assertEqual(self.client.get(f"{URL}resume/").data, {"count": 1, "produits": [self.produit.pk]})
        self.assertEqual(self.client.get(URL).data["count"], 3)

    def test_plafond_atteint_n_empeche_pas_de_reposter_un_existant(self):
        self.se_connecter(self.client_a)
        for i in range(50):
            p = self.produit.__class__.objects.create(famille=self.famille, nom=f"P{i}", reference=f"S-{i}")
            self.assertEqual(self.client.post(URL, {"produit": p.pk}, format="json").status_code, 201)
        self.assertEqual(self.client.post(URL, {"produit": self.produit.pk}, format="json").status_code, 400)
        self.assertEqual(self.client.post(URL, {"produit": p.pk}, format="json").status_code, 200)
        self.assertEqual(self.client.get(URL).data["count"], 50)
        # le plafond est par client
        self.se_connecter(self.client_b)
        self.assertEqual(self.client.post(URL, {"produit": self.produit.pk}, format="json").status_code, 201)

    def test_format_de_la_liste_et_prix_jamais_invente(self):
        self.se_connecter(self.client_a)
        self.client.post(URL, {"produit": self.produit.pk, "design": self.design.pk}, format="json")
        el = self.client.get(URL).data["elements"][0]
        self.assertEqual(set(el), {"id", "produit", "design", "ajoute_le", "disponible"})
        self.assertEqual(set(el["produit"]), {"id", "slug", "reference", "nom", "famille", "image", "prix",
                                              "unite_prix"})
        self.assertIsNone(el["produit"]["prix"])
        self.assertEqual(set(el["design"]) >= {"id", "nom", "couleur", "image"}, True)

    def test_suppression_d_un_element_d_autrui(self):
        e = ElementSelection.objects.create(utilisateur=self.client_b, produit=self.produit)
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.delete(f"{URL}{e.pk}/").status_code, 404)
        self.client.delete(URL)  # vider : seulement la sienne
        self.assertEqual(ElementSelection.objects.filter(utilisateur=self.client_b).count(), 1)

    def test_requetes_constantes(self):
        self.se_connecter(self.client_a)

        def mesurer():
            with CaptureQueriesContext(connection) as ctx:
                self.client.get(URL)
            return len(ctx)

        self.client.post(URL, {"produit": self.produit.pk, "design": self.design.pk}, format="json")
        avant = mesurer()
        for i in range(10):
            p = self.produit.__class__.objects.create(famille=self.famille, nom=f"P{i}", reference=f"Q-{i}")
            self.client.post(URL, {"produit": p.pk}, format="json")
        self.assertEqual(mesurer(), avant)
