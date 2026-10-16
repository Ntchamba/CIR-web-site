"""Tests complémentaires du catalogue (revue de l'agent backend-testeur, vague 1).

Performance des listes (requêtes N+1), pagination, slugs en lecture seule, traductions des objets imbriqués,
recherche, envoi de fichiers et données de référence.
"""
import json
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.catalogue.models import Caracteristique, Couche, Design, Famille, ImageProduit, Produit

from .outils import MediasTemporairesMixin, creer_client, creer_membre, image_png

URL = "/api/catalogue/"
URL_ADMIN = "/api/admin/catalogue/"


def _nombre_requetes(client, url, **extra):
    with CaptureQueriesContext(connection) as requetes:
        reponse = client.get(url, **extra)
    assert reponse.status_code == 200, reponse.content
    return len(requetes)


def _peupler(famille, nombre, depart=0):
    """Produits en ligne complets : 2 images, 1 design, 1 caractéristique, 1 couche chacun."""
    for i in range(depart, depart + nombre):
        produit = Produit.objects.create(famille=famille, nom=f"Produit {i}", reference=f"YD-{900 + i}")
        for ordre in range(2):
            ImageProduit.objects.create(produit=produit, image=image_png(), ordre=ordre)
        Design.objects.create(produit=produit, nom="Gris", couleur="#808080")
        Caracteristique.objects.create(produit=produit, libelle="Séchage", valeur="24 h")
        Couche.objects.create(produit=produit, nom="Finition", epaisseur="2 mm")


class RequetesN1Tests(MediasTemporairesMixin, APITestCase):
    """Le nombre de requêtes d'une liste ne dépend pas du nombre d'éléments."""

    def setUp(self):
        super().setUp()
        self.familles = [Famille.objects.create(nom=f"Famille {i}") for i in range(2)]
        _peupler(self.familles[0], 2)

    def test_liste_publique_des_produits(self):
        avant = _nombre_requetes(self.client, f"{URL}produits/")
        _peupler(self.familles[1], 4, depart=10)
        self.assertEqual(_nombre_requetes(self.client, f"{URL}produits/"), avant)

    def test_familles_publiques(self):
        avant = _nombre_requetes(self.client, f"{URL}familles/")
        for i in range(5):
            Famille.objects.create(nom=f"Autre {i}")
        self.assertEqual(_nombre_requetes(self.client, f"{URL}familles/"), avant)

    def test_listes_de_l_equipe(self):
        self.client.force_authenticate(creer_membre())
        avant_produits = _nombre_requetes(self.client, f"{URL_ADMIN}produits/")
        avant_familles = _nombre_requetes(self.client, f"{URL_ADMIN}familles/")
        _peupler(self.familles[1], 4, depart=10)
        Famille.objects.create(nom="Encore une")
        self.assertEqual(_nombre_requetes(self.client, f"{URL_ADMIN}produits/"), avant_produits)
        self.assertEqual(_nombre_requetes(self.client, f"{URL_ADMIN}familles/"), avant_familles)


class PaginationTests(APITestCase):
    def setUp(self):
        famille = Famille.objects.create(nom="Finitions")
        Produit.objects.bulk_create([Produit(famille=famille, nom=f"P{i}", slug=f"p{i}") for i in range(30)])

    def test_24_par_page_taille_et_plafond(self):
        r = self.client.get(f"{URL}produits/")
        self.assertEqual((r.data["count"], len(r.data["results"])), (30, 24))
        self.assertIsNotNone(r.data["next"])
        self.assertIsNone(r.data["previous"])
        self.assertTrue(r.data["next"].startswith("http://testserver/"))
        self.assertEqual(len(self.client.get(f"{URL}produits/?taille=5").data["results"]), 5)
        self.assertEqual(len(self.client.get(f"{URL}produits/?page=2").data["results"]), 6)
        r = self.client.get(f"{URL}produits/?taille=1000")
        self.assertEqual(len(r.data["results"]), 30)  # plafond 100 : tout tient sur une page
        self.assertEqual(self.client.get(f"{URL}produits/?page=9").status_code, 404)


class SlugsEnLectureSeuleTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(creer_membre())
        self.famille = Famille.objects.create(nom="Finitions")

    def test_slug_envoye_ignore_et_stable_apres_renommage(self):
        r = self.client.post(f"{URL_ADMIN}produits/", {"famille": self.famille.id, "nom": "Sol autolissant",
                                                       "reference": "yd-500", "slug": "pirate"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["slug"], "sol-autolissant-yd-500")
        self.assertEqual(r.data["reference"], "YD-500")  # référence normalisée en majuscules
        r = self.client.patch(f"{URL_ADMIN}produits/{r.data['id']}/", {"nom": "Autre nom", "slug": "x"},
                              format="json")
        self.assertEqual(r.data["slug"], "sol-autolissant-yd-500")
        r = self.client.patch(f"{URL_ADMIN}familles/{self.famille.id}/", {"nom": "Nouveau nom", "slug": "y"},
                              format="json")
        self.assertEqual((r.status_code, r.data["slug"]), (200, "finitions"))

    def test_slugs_uniques_pour_des_noms_identiques(self):
        slugs = set()
        for _ in range(3):
            r = self.client.post(f"{URL_ADMIN}produits/", {"famille": self.famille.id, "nom": "Primaire"},
                                 format="json")
            slugs.add(r.data["slug"])
        self.assertEqual(slugs, {"primaire", "primaire-2", "primaire-3"})


class ValidationsEquipeTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())
        self.famille = Famille.objects.create(nom="Finitions")
        self.produit = Produit.objects.create(famille=self.famille, nom="Sol")

    def test_prix_refuses(self):
        for valeur in (12.5, "12,5", True, 2_000_000_000, "1e3"):
            with self.subTest(valeur=valeur):
                r = self.client.patch(f"{URL_ADMIN}produits/{self.produit.id}/", {"prix": valeur}, format="json")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn("prix", r.data)
        r = self.client.patch(f"{URL_ADMIN}produits/{self.produit.id}/", {"prix": ""}, format="json")
        self.assertEqual((r.status_code, r.data["prix"]), (200, None))

    def test_traductions_des_lignes_imbriquees_controlees(self):
        for lignes in ([{"libelle": "Séchage", "valeur": "24 h", "traductions": {"en": {"nom": "Drying"}}}],
                       [{"libelle": "Séchage", "valeur": "24 h", "traductions": {"fr": {"libelle": "x"}}}],
                       [{"libelle": "Séchage", "valeur": "24 h", "traductions": "texte"}]):
            with self.subTest(lignes=lignes):
                r = self.client.patch(f"{URL_ADMIN}produits/{self.produit.id}/", {"caracteristiques": lignes},
                                      format="json")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn("caracteristiques", r.data)
        r = self.client.patch(f"{URL_ADMIN}produits/{self.produit.id}/",
                              {"couches": [{"nom": "Surface", "traductions": {"en": {"nom": "  Top  ", "epaisseur": None}}}]},
                              format="json")
        self.assertEqual(r.status_code, 400)  # « epaisseur » ne se traduit pas
        r = self.client.patch(f"{URL_ADMIN}produits/{self.produit.id}/",
                              {"couches": [{"nom": "Surface", "traductions": {"en": {"nom": "  Top  "}}}]},
                              format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["couches"][0]["traductions"], {"en": {"nom": "Top"}})
        self.assertEqual(r.data["couches"][0]["langues_incompletes"], ["zh", "de", "ja"])

    def test_envoi_d_un_faux_fichier_image_refuse(self):
        faux = [SimpleUploadedFile("photo.png", b"<html><script>alert(1)</script></html>", content_type="image/png"),
                SimpleUploadedFile("photo.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
                                   content_type="image/svg+xml")]
        for fichier in faux:
            with self.subTest(nom=fichier.name):
                r = self.client.post(f"{URL_ADMIN}produits/{self.produit.id}/images/", {"image": fichier},
                                     format="multipart")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn("image", r.data)
        self.assertFalse(ImageProduit.objects.exists())

    def test_nom_de_fichier_malveillant_neutralise(self):
        r = self.client.post(f"{URL_ADMIN}produits/{self.produit.id}/images/",
                             {"image": image_png("../../../../etc/passwd.png")}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        nom = ImageProduit.objects.get().image.name
        self.assertTrue(nom.startswith("catalogue/produits/"), nom)
        self.assertNotIn("..", nom)
        self.assertTrue(nom.endswith(".webp"))

    def test_image_ordre_suivant_et_fichier_non_remplacable(self):
        ids = [self.client.post(f"{URL_ADMIN}produits/{self.produit.id}/images/", {"image": image_png()},
                                format="multipart").data["id"] for _ in range(2)]
        self.assertEqual(list(ImageProduit.objects.order_by("id").values_list("ordre", flat=True)), [0, 1])
        nom_avant = ImageProduit.objects.get(pk=ids[0]).image.name
        r = self.client.patch(f"{URL_ADMIN}images/{ids[0]}/", {"image": image_png("autre.png")}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(ImageProduit.objects.get(pk=ids[0]).image.name, nom_avant)

    def test_routes_images_et_designs_reservees_a_l_equipe(self):
        image = ImageProduit.objects.create(produit=self.produit, image=image_png())
        design = Design.objects.create(produit=self.produit, nom="Gris")
        routes = [("post", f"{URL_ADMIN}produits/{self.produit.id}/images/"),
                  ("post", f"{URL_ADMIN}produits/{self.produit.id}/designs/"),
                  ("patch", f"{URL_ADMIN}images/{image.id}/"), ("delete", f"{URL_ADMIN}images/{image.id}/"),
                  ("patch", f"{URL_ADMIN}designs/{design.id}/"), ("delete", f"{URL_ADMIN}designs/{design.id}/")]
        for utilisateur, attendu in ((None, 401), (creer_client(), 403)):
            self.client.force_authenticate(utilisateur)
            for methode, route in routes:
                with self.subTest(utilisateur=utilisateur, route=route, methode=methode):
                    self.assertEqual(getattr(self.client, methode)(route, {}, format="json").status_code, attendu)
        self.assertTrue(ImageProduit.objects.exists())
        self.assertTrue(Design.objects.exists())

    def test_ecritures_publiques_impossibles(self):
        self.client.force_authenticate(creer_client())
        self.assertEqual(self.client.post(f"{URL}produits/", {"nom": "x"}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(f"{URL}produits/{self.produit.slug}/").status_code, 405)


class TraductionsPubliquesTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        famille = Famille.objects.create(nom="Finitions", description="Belles finitions",
                                         traductions={"ja": {"nom": "上塗り"}})
        self.produit = Produit.objects.create(
            famille=famille, nom="Sol", dosage="1 kg/m²", preparation="Poncer",
            traductions={"en": {"nom": "Floor", "dosage": "1 kg/sqm", "preparation": "   "}})
        Caracteristique.objects.create(produit=self.produit, libelle="Séchage", valeur="24 h",
                                       traductions={"en": {"libelle": "Drying"}})
        Couche.objects.create(produit=self.produit, nom="Finition", traductions={"en": {"nom": "Top coat"}})
        Design.objects.create(produit=self.produit, nom="Gris", traductions={"en": {"nom": "Grey"}})
        ImageProduit.objects.create(produit=self.produit, image=image_png(), alt="Vue", traductions={"en": {"alt": "View"}})

    def test_fiche_et_objets_imbriques_en_anglais_avec_secours_francais(self):
        r = self.client.get(f"{URL}produits/{self.produit.slug}/", HTTP_ACCEPT_LANGUAGE="en-US,en;q=0.9")
        self.assertEqual(r.data["nom"], "Floor")
        self.assertEqual(r.data["mise_en_oeuvre"]["dosage"], "1 kg/sqm")
        self.assertEqual(r.data["mise_en_oeuvre"]["preparation"], "Poncer")  # traduction vide : français
        self.assertEqual(r.data["caracteristiques"], [{"libelle": "Drying", "valeur": "24 h"}])
        self.assertEqual(r.data["couches"][0]["nom"], "Top coat")
        self.assertEqual(r.data["designs"][0]["nom"], "Grey")
        self.assertEqual(r.data["images"][0]["alt"], "View")
        self.assertEqual(r.data["famille"]["nom"], "Finitions")
        self.assertNotIn("traductions", json.dumps(r.data))

    def test_langue_inconnue_donne_le_francais(self):
        r = self.client.get(f"{URL}familles/", HTTP_ACCEPT_LANGUAGE="es")
        self.assertEqual(r.data[0]["nom"], "Finitions")
        r = self.client.get(f"{URL}familles/", HTTP_ACCEPT_LANGUAGE="ja")
        self.assertEqual((r.data[0]["nom"], r.data[0]["description"]), ("上塗り", "Belles finitions"))


class RechercheTests(APITestCase):
    def setUp(self):
        famille = Famille.objects.create(nom="Finitions")
        self.produit = Produit.objects.create(famille=famille, nom="Sol", reference="YD-500",
                                              traductions={"en": {"nom": "Floor", "dosage": "1 kg"}})

    def test_recherche_dans_le_texte_traduit(self):
        self.assertEqual(self.client.get(f"{URL}produits/?search=floor").data["count"], 1)

    def test_recherche_ne_trouve_pas_les_cles_du_json(self):
        """« dosage », « nom » ou « en » sont des clés du JSON `traductions`, pas du texte du produit."""
        for mot in ("dosage", "nom"):
            with self.subTest(mot=mot):
                self.assertEqual(self.client.get(f"{URL}produits/?search={mot}").data["count"], 0)

    def test_recherche_resiste_aux_caracteres_speciaux(self):
        for mot in ("%", "_", "'; DROP TABLE catalogue_produit; --", "\\"):
            with self.subTest(mot=mot):
                r = self.client.get(f"{URL}produits/", {"search": mot})
                self.assertEqual(r.status_code, 200)
                self.assertEqual(r.data["count"], 0)
        self.assertTrue(Produit.objects.exists())


class DonneesDeReferenceTests(TestCase):
    def test_contenu_conforme_au_cahier_des_charges(self):
        call_command("charger_catalogue_reference", stdout=StringIO())
        self.assertEqual(Famille.objects.count(), 9)
        references = set(Produit.objects.values_list("reference", flat=True))
        self.assertEqual(references, {"YD-500", "YD-306", "YD-518", "YD-103", "YD-104", "YD-205", "YD-106W",
                                      "YD-206W", "YD-306W"})
        self.assertFalse(Produit.objects.exclude(prix=None).exists())
        self.assertFalse(Produit.objects.filter(en_ligne=False).exists())
        self.assertFalse(ImageProduit.objects.exists() or Design.objects.exists())
        self.assertFalse(Caracteristique.objects.exists() or Couche.objects.exists())
        self.assertEqual(set(Produit.objects.filter(a_la_une=True).values_list("reference", flat=True)),
                         {"YD-500", "YD-306", "YD-518"})
        for famille in Famille.objects.all():
            with self.subTest(famille=famille.nom):
                self.assertEqual(famille.langues_incompletes(), [])
        self.assertEqual(Produit.objects.get(reference="YD-205").famille.nom, "Couche intermédiaire époxy")
        self.assertEqual(Produit.objects.get(reference="YD-306W").famille.nom, "Époxy sans solvant")
        call_command("charger_catalogue_reference", stdout=StringIO())
        self.assertEqual((Famille.objects.count(), Produit.objects.count()), (9, 9))
