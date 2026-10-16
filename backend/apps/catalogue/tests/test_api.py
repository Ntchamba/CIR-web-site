"""API du catalogue : publique (/api/catalogue/) et équipe (/api/admin/catalogue/)."""
import json

from rest_framework.test import APITestCase

from apps.catalogue.models import Design, Famille, ImageProduit, Produit

from .outils import MediasTemporairesMixin, creer_client, creer_membre, image_png

URL = "/api/catalogue/"
URL_ADMIN = "/api/admin/catalogue/"


class Base(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.famille = Famille.objects.create(nom="Finitions", traductions={"en": {"nom": "Finishes"}})
        self.produit = Produit.objects.create(
            famille=self.famille, nom="Sol autolissant", reference="YD-500", pour_maison=True, a_la_une=True,
            accroche="Sol lisse", traductions={"en": {"nom": "Self-levelling floor"}, "zh": {"nom": "自流平地坪"}})
        self.cache = Produit.objects.create(famille=self.famille, nom="Hors ligne", en_ligne=False)


class CataloguePublicTests(Base):
    def test_familles_tableau_simple_avec_compte_en_ligne(self):
        r = self.client.get(f"{URL}familles/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, [{"id": self.famille.id, "nom": "Finitions", "slug": "finitions", "description": "",
                                   "nombre_produits": 1}])

    def test_liste_paginee_carte_produit(self):
        r = self.client.get(f"{URL}produits/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        carte = r.data["results"][0]
        self.assertEqual(set(carte), {"id", "slug", "reference", "nom", "accroche", "famille", "usages", "prix",
                                      "unite_prix", "image", "est_nouveau", "a_la_une"})
        self.assertEqual(carte["famille"], {"slug": "finitions", "nom": "Finitions"})
        self.assertEqual(carte["usages"], ["maison"])
        self.assertIsNone(carte["prix"])
        self.assertIsNone(carte["image"])
        self.assertNotIn("traductions", carte)

    def test_prix_en_chaine_et_image_absolue(self):
        Produit.objects.filter(pk=self.produit.pk).update(prix=12500)
        ImageProduit.objects.create(produit=self.produit, image=image_png(), alt="")
        carte = self.client.get(f"{URL}produits/").data["results"][0]
        self.assertEqual(carte["prix"], "12500")
        self.assertTrue(carte["image"]["url"].startswith("http://testserver/media/catalogue/produits/"))
        self.assertTrue(carte["image"]["url"].endswith(".webp"))
        self.assertEqual(carte["image"]["alt"], "Sol autolissant")

    def test_filtres(self):
        autre = Produit.objects.create(famille=Famille.objects.create(nom="Primaires"), nom="Primaire",
                                       reference="YD-103", pour_industrie=True, est_nouveau=True)
        cas = {"famille=primaires": [autre.id], "usage=maison": [self.produit.id], "usage=industrie": [autre.id],
               "nouveau=1": [autre.id], "a_la_une=1": [self.produit.id], "search=yd-103": [autre.id],
               "search=Self-levelling": [self.produit.id], "search=hors": []}
        for requete, attendus in cas.items():
            with self.subTest(requete=requete):
                r = self.client.get(f"{URL}produits/?{requete}")
                self.assertEqual([p["id"] for p in r.data["results"]], attendus)
        self.assertEqual(self.client.get(f"{URL}produits/?usage=piscine").status_code, 400)

    def test_detail_et_404_hors_ligne(self):
        self.produit.couches.create(nom="Finition", epaisseur="2 mm", ordre=0)
        self.produit.caracteristiques.create(libelle="Séchage", valeur="24 h")
        Design.objects.create(produit=self.produit, nom="Gris", couleur="#808080")
        r = self.client.get(f"{URL}produits/{self.produit.slug}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["couches"], [{"nom": "Finition", "epaisseur": "2 mm"}])
        self.assertEqual(r.data["caracteristiques"], [{"libelle": "Séchage", "valeur": "24 h"}])
        self.assertEqual(r.data["designs"][0]["image"], None)
        self.assertEqual(set(r.data["mise_en_oeuvre"]),
                         {"preparation", "methode_application", "dosage", "conditions_chantier"})
        self.assertEqual(self.client.get(f"{URL}produits/{self.cache.slug}/").status_code, 404)

    def test_textes_dans_la_langue_demandee(self):
        for entete, nom, famille in [("en", "Self-levelling floor", "Finishes"), ("zh-CN", "自流平地坪", "Finitions"),
                                     ("de", "Sol autolissant", "Finitions"), ("", "Sol autolissant", "Finitions")]:
            with self.subTest(entete=entete):
                extra = {"HTTP_ACCEPT_LANGUAGE": entete} if entete else {}
                carte = self.client.get(f"{URL}produits/", **extra).data["results"][0]
                self.assertEqual(carte["nom"], nom)
                self.assertEqual(carte["famille"]["nom"], famille)

    def test_jeton_invalide_ignore_en_lecture_publique(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer jeton-perime")
        self.assertEqual(self.client.get(f"{URL}produits/").status_code, 200)


class CatalogueEquipeTests(Base):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())

    def test_acces_reserve_a_l_equipe(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{URL_ADMIN}produits/").status_code, 401)
        self.client.force_authenticate(creer_client())
        self.assertEqual(self.client.get(f"{URL_ADMIN}produits/").status_code, 403)
        self.assertEqual(self.client.post(f"{URL_ADMIN}familles/", {"nom": "X"}, format="json").status_code, 403)

    def test_familles_crud(self):
        r = self.client.post(f"{URL_ADMIN}familles/", {"nom": "Primaires", "traductions": {"en": {"nom": "Primers"}}},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["slug"], "primaires")
        self.assertEqual(r.data["nombre_produits"], 0)
        self.assertEqual(r.data["langues_incompletes"], ["zh", "de", "ja"])
        liste = self.client.get(f"{URL_ADMIN}familles/").data
        self.assertIsInstance(liste, list)
        r = self.client.delete(f"{URL_ADMIN}familles/{self.famille.id}/")
        self.assertEqual(r.status_code, 400)
        self.assertIn("detail", r.data)
        self.assertEqual(self.client.post(f"{URL_ADMIN}familles/", {"nom": "finitions"}, format="json").status_code,
                         400)

    def test_creation_produit_avec_lignes(self):
        donnees = {
            "famille": self.famille.id, "nom": "Terrazzo époxy", "reference": "YD-518", "prix": "15 000",
            "unite_prix": "m2", "traductions": {"en": {"nom": "Epoxy terrazzo"}},
            "caracteristiques": [{"libelle": "Séchage", "valeur": "24 h", "traductions": {"en": {"libelle": "Drying"}}}],
            "couches": [{"nom": "Finition", "epaisseur": "3 mm"}, {"nom": "Primaire", "epaisseur": ""}],
        }
        r = self.client.post(f"{URL_ADMIN}produits/", donnees, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["prix"], "15000")
        self.assertEqual(r.data["famille"], self.famille.id)
        self.assertEqual(r.data["caracteristiques"][0]["traductions"], {"en": {"libelle": "Drying"}})
        self.assertIn("langues_incompletes", r.data["caracteristiques"][0])
        self.assertEqual([c["nom"] for c in r.data["couches"]], ["Finition", "Primaire"])
        r = self.client.patch(f"{URL_ADMIN}produits/{r.data['id']}/", {"prix": None, "couches": []}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.data["prix"])
        self.assertEqual(r.data["couches"], [])

    def test_validations_produit(self):
        base = {"famille": self.famille.id, "nom": "X"}
        for champ, valeur in [("prix", "-3"), ("prix", "abc"), ("unite_prix", "litre"), ("reference", "yd-500"),
                              ("traductions", {"es": {"nom": "x"}}), ("traductions", {"en": {"prix": "1"}})]:
            with self.subTest(champ=champ, valeur=valeur):
                r = self.client.post(f"{URL_ADMIN}produits/", {**base, champ: valeur}, format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn(champ, r.data)

    def test_multipart_chaines_json(self):
        r = self.client.post(f"{URL_ADMIN}produits/", {
            "famille": self.famille.id, "nom": "Multipart", "traductions": json.dumps({"de": {"nom": "Mehrteilig"}}),
            "couches": json.dumps([{"nom": "Surface", "epaisseur": "1 mm"}]),
        }, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["traductions"], {"de": {"nom": "Mehrteilig"}})
        self.assertEqual(r.data["couches"][0]["nom"], "Surface")
        r = self.client.post(f"{URL_ADMIN}produits/", {"famille": self.famille.id, "nom": "Y", "couches": "{pas json"},
                             format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("couches", r.data)

    def test_filtres_equipe(self):
        r = self.client.get(f"{URL_ADMIN}produits/?en_ligne=0")
        self.assertEqual([p["id"] for p in r.data["results"]], [self.cache.id])
        r = self.client.get(f"{URL_ADMIN}produits/?famille={self.famille.id}&search=autolissant")
        self.assertEqual([p["id"] for p in r.data["results"]], [self.produit.id])

    def test_images_et_designs(self):
        r = self.client.post(f"{URL_ADMIN}produits/{self.produit.id}/images/",
                             {"image": image_png(), "alt": "Vue", "traductions": json.dumps({"en": {"alt": "View"}})},
                             format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data["url"].startswith("http://testserver/media/"))
        self.assertNotIn("image", r.data)
        image_id = r.data["id"]
        r = self.client.patch(f"{URL_ADMIN}images/{image_id}/", {"alt": "Vue 2", "ordre": 3}, format="json")
        self.assertEqual((r.status_code, r.data["alt"], r.data["ordre"]), (200, "Vue 2", 3))

        r = self.client.post(f"{URL_ADMIN}produits/{self.produit.id}/designs/",
                             {"nom": "Gris béton", "couleur": "#a0a0a0", "image": image_png()}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["couleur"], "#A0A0A0")
        self.assertTrue(r.data["image"].startswith("http://testserver/media/catalogue/designs/"))
        design_id = r.data["id"]
        r = self.client.patch(f"{URL_ADMIN}designs/{design_id}/", {"couleur": "rouge"}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("couleur", r.data)
        r = self.client.patch(f"{URL_ADMIN}designs/{design_id}/", {"image": ""}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.data["image"])

        produit = self.client.get(f"{URL_ADMIN}produits/{self.produit.id}/").data
        self.assertEqual(len(produit["images"]), 1)
        self.assertEqual(len(produit["designs"]), 1)
        self.assertEqual(self.client.delete(f"{URL_ADMIN}images/{image_id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"{URL_ADMIN}designs/{design_id}/").status_code, 204)

    def test_image_invalide_400_sur_le_champ(self):
        from unittest import mock

        from apps.noyau.images import ImageInvalide
        with mock.patch("apps.noyau.medias.optimiser_champ_image", side_effect=ImageInvalide("Trop lourde")):
            r = self.client.post(f"{URL_ADMIN}produits/{self.produit.id}/images/", {"image": image_png()},
                                 format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data, {"image": ["Trop lourde"]})
        self.assertFalse(ImageProduit.objects.exists())

    def test_message_d_erreur_traduit(self):
        r = self.client.post(f"{URL_ADMIN}produits/", {"famille": self.famille.id, "nom": "X", "prix": "-3"},
                             format="json", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(str(r.data["prix"][0]), "The price cannot be negative.")
