"""Revue du testeur (vague 2) : contact, anti-robot, charges hostiles, droits et requêtes."""
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework_simplejwt.tokens import AccessToken

from apps.comptes.models import Utilisateur
from apps.contact.models import DemandeContact
from apps.contact.tests.test_api import URL, URL_ADMIN, VISITEUR, Base


class EnvoiRevueTests(Base):
    def test_corps_qui_n_est_pas_un_objet(self):
        for corps in ("[]", '["a"]', '"texte"', "12", "null"):
            with self.subTest(corps=corps):
                cache.clear()
                r = self.client.post(URL, corps, content_type="application/json")
                self.assertIn(r.status_code, (400, 415), r.content)
        r = self.client.post(URL, "{pas du json", content_type="application/json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(DemandeContact.objects.count(), 0)

    def test_champ_piege_espaces_seuls_n_est_pas_un_piege(self):
        r = self.client.post(URL, {**VISITEUR, "site_web": "   "}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertGreater(r.data["id"], 0)
        self.assertEqual(DemandeContact.objects.count(), 1)

    def test_champ_piege_en_formulaire_et_pour_un_client_connecte(self):
        r = self.client.post(URL, {**VISITEUR, "site_web": "x"})  # multipart
        self.assertEqual((r.status_code, r.data["id"]), (201, 0))
        self.client.force_authenticate(self.client_a)
        r = self.client.post(URL, {"type": "question", "message": "Bonjour tout le monde", "site_web": "x"},
                             format="json")
        self.assertEqual((r.status_code, r.data["id"]), (201, 0))
        self.assertEqual(DemandeContact.objects.count(), 0)

    def test_champs_non_prevus_ignores(self):
        r = self.client.post(URL, {**VISITEUR, "etat": "traitee", "reponse_equipe": "Fait", "notes_internes": "x",
                                   "auteur": self.client_a.pk, "langue": "zz", "traitee_le": "2026-01-01T00:00:00Z",
                                   "reference": "CTC-1999-0001", "id": 4242}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        d = DemandeContact.objects.get()
        self.assertEqual((d.etat, d.reponse_equipe, d.notes_internes, d.auteur, d.traitee_le), ("nouvelle", "", "",
                                                                                                None, None))
        self.assertNotEqual(d.reference, "CTC-1999-0001")
        self.assertNotEqual(d.pk, 4242)

    def test_bornes(self):
        cas = [{"nom": "x" * 151}, {"message": "abcd"}, {"message": "    ab    "}, {"message": "x" * 1001},
               {"email": "a@b"}, {"email": "x" * 250 + "@a.cm"}, {"telephone": "12345"}, {"telephone": "1" * 31},
               {"telephone": "<script>"}, {"produit": "abc"}, {"produit": [1]}, {"creneau": "nuit", "type": "rappel",
                                                                                 "telephone": "699000000"},
               {"message": "Allez sur HTTPS://x.cm"}, {"message": "visitez WWW.x.cm"}, {"nom": "   "}]
        for plus in cas:
            with self.subTest(plus=str(plus)[:50]):
                cache.clear()
                self.assertEqual(self.client.post(URL, {**VISITEUR, **plus}, format="json").status_code, 400)
        self.assertEqual(DemandeContact.objects.count(), 0)

    def test_message_borne_et_contenu_stocke_tel_quel(self):
        r = self.client.post(URL, {**VISITEUR, "message": "x" * 1000}, format="json")
        self.assertEqual(r.status_code, 201)
        cache.clear()
        r = self.client.post(URL, {**VISITEUR, "nom": "<b>Bob</b>", "email": "BOB@Exemple.CM ",
                                   "message": "'); DROP TABLE contact_demandecontact;-- <script>1</script>"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        d = DemandeContact.objects.latest("id")
        self.assertEqual(d.email, "bob@exemple.cm")
        self.assertIn("<script>", d.message)
        self.assertEqual(DemandeContact.objects.count(), 2)

    def test_quota_ip_compte_les_envois_invalides_et_le_piege(self):
        for _i in range(3):
            self.client.post(URL, {**VISITEUR, "message": "ok"}, format="json")  # invalides
        self.client.post(URL, {**VISITEUR, "site_web": "x"}, format="json")
        self.client.post(URL, VISITEUR, format="json")
        self.assertEqual(self.client.post(URL, VISITEUR, format="json").status_code, 429)

    def test_quota_ip_ne_touche_pas_les_autres_routes(self):
        for _i in range(5):
            self.client.post(URL, VISITEUR, format="json")
        self.client.force_authenticate(self.client_a)
        self.assertEqual(self.client.get(f"{URL}miennes/").status_code, 200)

    def test_equipe_peut_ecrire_a_titre_de_compte(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post(URL, {"type": "question", "message": "Bonjour tout le monde"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_jeton_d_un_compte_desactive_ou_supprime_ne_bloque_pas_un_visiteur(self):
        jeton = str(AccessToken.for_user(self.client_a))
        Utilisateur.objects.filter(pk=self.client_a.pk).update(is_active=False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton}")
        r = self.client.post(URL, VISITEUR, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNone(DemandeContact.objects.get().auteur)
        cache.clear()
        jeton = str(AccessToken.for_user(self.membre))
        self.membre.delete()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton}")
        self.assertEqual(self.client.post(URL, VISITEUR, format="json").status_code, 201)

    def test_jeton_valide_rattache_la_demande_au_compte(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.client_a)}")
        r = self.client.post(URL, {"type": "question", "message": "Bonjour tout le monde"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(DemandeContact.objects.get().auteur, self.client_a)


class DroitsRevueTests(Base):
    def setUp(self):
        super().setUp()
        self.a = DemandeContact.objects.create(auteur=self.client_a, nom="Alice", email="a@exemple.cm",
                                               message="Bonjour", notes_internes="SECRET-INTERNE")

    def test_routes_equipe_fermees_aux_clients_et_visiteurs(self):
        chemins = [("get", URL_ADMIN), ("get", f"{URL_ADMIN}{self.a.pk}/"), ("get", f"{URL_ADMIN}resume/"),
                   ("patch", f"{URL_ADMIN}{self.a.pk}/")]
        for qui, code in ((None, 401), (self.client_a, 403)):
            self.client.force_authenticate(qui)
            for methode, chemin in chemins:
                with self.subTest(qui=str(qui), chemin=chemin):
                    r = getattr(self.client, methode)(chemin, {"etat": "traitee"}, format="json")
                    self.assertEqual(r.status_code, code)
        self.a.refresh_from_db()
        self.assertEqual(self.a.etat, "nouvelle")

    def test_methodes_non_prevues_et_champs_en_lecture_seule(self):
        self.client.force_authenticate(self.membre)
        for methode in ("post", "put", "delete"):
            self.assertEqual(getattr(self.client, methode)(f"{URL_ADMIN}{self.a.pk}/", {}, format="json").status_code,
                             405)
        r = self.client.patch(f"{URL_ADMIN}{self.a.pk}/", {"nom": "Pirate", "message": "x", "email": "p@p.cm",
                                                           "notes_internes": "Noté"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.a.refresh_from_db()
        self.assertEqual((self.a.nom, self.a.message, self.a.notes_internes), ("Alice", "Bonjour", "Noté"))

    def test_client_ne_voit_que_les_siennes_et_sans_notes(self):
        autre = DemandeContact.objects.create(auteur=self.client_b if hasattr(self, "client_b") else None,
                                              nom="Autre", message="Message d'autrui")
        self.client.force_authenticate(self.client_a)
        r = self.client.get(f"{URL}miennes/")
        corps = r.content.decode()
        self.assertEqual([x["id"] for x in r.data["results"]], [self.a.pk])
        self.assertNotIn("SECRET-INTERNE", corps)
        self.assertNotIn("notes_internes", corps)
        self.assertNotIn("Message d'autrui", corps)
        self.assertEqual(self.client.get(f"{URL}{autre.pk}/").status_code, 404)

    def test_recherche_hostile_et_pagination(self):
        self.client.force_authenticate(self.membre)
        for hostile in ("'; DROP TABLE x;--", "%", "\\", "\x00"):
            self.assertEqual(self.client.get(URL_ADMIN, {"search": hostile, "etat": hostile, "type": hostile})
                             .status_code in (200, 400), True)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?taille=1").data["count"], 1)
        self.assertEqual(self.client.get(f"{URL_ADMIN}abc/").status_code, 404)

    def test_requetes_constantes(self):
        def mesurer(url, qui):
            self.client.force_authenticate(qui)
            with CaptureQueriesContext(connection) as ctx:
                self.assertEqual(self.client.get(url).status_code, 200)
            return len(ctx)

        avant = (mesurer(URL_ADMIN, self.membre), mesurer(f"{URL}miennes/", self.client_a))
        for i in range(10):
            DemandeContact.objects.create(auteur=self.client_a, nom="A", message="Bonjour", produit=self.produit)
        self.assertEqual((mesurer(URL_ADMIN, self.membre), mesurer(f"{URL}miennes/", self.client_a)), avant)


class CorrectionsRevueTests(Base):
    def test_corps_non_objet_donne_400_jamais_500(self):
        for corps in ("[]", '["a"]', '"texte"', "12", "null"):
            with self.subTest(corps=corps):
                cache.clear()
                r = self.client.post(URL, corps, content_type="application/json")
                self.assertEqual(r.status_code, 400, r.content)
