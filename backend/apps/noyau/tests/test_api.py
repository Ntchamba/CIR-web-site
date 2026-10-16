"""Tests d'API du noyau : /api/sante/ et comportements communs (authentification par défaut, pagination)."""
from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role


class SanteApiTests(APITestCase):
    url = "/api/sante/"

    def test_ok_sans_authentification(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"statut": "ok", "base_de_donnees": True})

    def test_ignore_un_jeton_invalide(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer jeton-invalide")
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_base_inaccessible_renvoie_503(self):
        with mock.patch("apps.noyau.sante.connection") as connexion, self.assertLogs("cir", "ERROR"):
            connexion.cursor.side_effect = Exception("base tombée")
            r = self.client.get(self.url)
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"statut": "degrade", "base_de_donnees": False})

    def test_seul_get_est_accepte(self):
        for methode in ("post", "put", "patch", "delete"):
            self.assertEqual(getattr(self.client, methode)(self.url).status_code, 405, methode)

    def test_ne_divulgue_rien_d_autre(self):
        self.assertEqual(set(self.client.get(self.url).json()), {"statut", "base_de_donnees"})


class ReglagesApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_authentification_exigee_par_defaut(self):
        self.assertEqual(self.client.get("/api/comptes/moi/").status_code, 401)

    def test_pagination_standard_sur_une_liste_reelle(self):
        equipe = Utilisateur.objects.create_user("m@cir.cm", "x", nom_complet="M", role=Role.MEMBRE)
        Utilisateur.objects.bulk_create(
            [Utilisateur(email=f"c{i}@exemple.cm", nom_complet=f"C{i}") for i in range(30)]
        )
        self.client.force_authenticate(equipe)
        r = self.client.get("/api/admin/comptes/clients/")
        self.assertEqual(r.data["count"], 30)
        self.assertEqual(len(r.data["results"]), 24)
        r = self.client.get("/api/admin/comptes/clients/?taille=5&page=2")
        self.assertEqual(len(r.data["results"]), 5)

    def test_administration_django_a_l_adresse_cachee(self):
        from django.conf import settings
        self.assertNotEqual(settings.ADMIN_URL.strip("/"), "admin")
        self.assertEqual(self.client.get("/admin/").status_code, 404)
        self.assertIn(self.client.get(f"/{settings.ADMIN_URL}").status_code, (200, 302))
