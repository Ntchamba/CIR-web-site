"""API du contact : envoi public, anti-robot, quotas, suivi client, boîte de réception de l'équipe."""
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre
from apps.contact.models import DemandeContact

URL = "/api/contact/demandes/"
URL_ADMIN = "/api/admin/contact/demandes/"
VISITEUR = {"nom": "Visiteur", "email": "v@exemple.cm", "type": "question", "message": "Bonjour, quels délais ?"}


class Base(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.produit = Produit.objects.create(famille=Famille.objects.create(nom="F"), nom="Sol", reference="YD-500")
        self.client_a = creer_client("a@exemple.cm", "Alice")
        self.membre = creer_membre()


class EnvoiTests(Base):
    def test_visiteur(self):
        r = self.client.post(URL, {**VISITEUR, "produit": self.produit.pk}, format="json", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(set(r.data), {"id", "reference"})
        self.assertRegex(r.data["reference"], r"^CTC-\d{4}-0001$")
        d = DemandeContact.objects.get()
        self.assertEqual((d.auteur, d.langue, d.etat, d.creneau, d.produit), (None, "en", "nouvelle", "", self.produit))

    def test_regles_visiteur(self):
        cas = [({"nom": ""}, "nom"), ({"email": "", "telephone": ""}, "email"), ({"email": "pasunmail"}, "email"),
               ({"message": "ok"}, "message"), ({"message": "x" * 1001}, "message"),
               ({"message": "Voir http://spam.example"}, "message"), ({"message": "voir www.spam.example ok"}, "message"),
               ({"type": "rappel"}, "telephone"), ({"type": "zzz"}, "type"), ({"telephone": "abc"}, "telephone"),
               ({"produit": 9999}, "produit"), ({"type": "rappel", "telephone": "+237 699 00 00 00",
                                                 "creneau": "minuit"}, "creneau")]
        for plus, champ in cas:
            with self.subTest(plus=plus):
                cache.clear()  # le quota par IP compte aussi les essais invalides
                r = self.client.post(URL, {**VISITEUR, **plus}, format="json")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn(champ, r.data)
        self.assertEqual(DemandeContact.objects.count(), 0)

    def test_rappel_avec_creneau(self):
        r = self.client.post(URL, {"nom": "V", "telephone": "+237 699 00 00 00", "type": "rappel", "creneau": "soir",
                                   "message": "Rappelez-moi"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        d = DemandeContact.objects.get()
        self.assertEqual((d.type, d.creneau, d.email), ("rappel", "soir", ""))
        self.client.post(URL, {"nom": "V", "telephone": "699000000", "type": "rappel", "message": "Rappelez-moi"},
                         format="json")
        self.assertEqual(DemandeContact.objects.latest("id").creneau, "peu_importe")

    def test_champ_piege_faux_succes(self):
        r = self.client.post(URL, {**VISITEUR, "site_web": "http://robot.example"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(set(r.data), {"id", "reference"})
        self.assertEqual(DemandeContact.objects.count(), 0)
        # même une demande invalide est un faux succès pour le robot
        self.assertEqual(self.client.post(URL, {"site_web": "x"}, format="json").status_code, 201)

    def test_quota_par_adresse_ip(self):
        for _i in range(5):
            self.assertEqual(self.client.post(URL, VISITEUR, format="json").status_code, 201)
        self.assertEqual(self.client.post(URL, VISITEUR, format="json").status_code, 429)
        self.assertEqual(DemandeContact.objects.count(), 5)

    def test_client_connecte_reprend_son_compte_et_peut_mettre_un_lien(self):
        self.client.force_authenticate(self.client_a)
        r = self.client.post(URL, {"type": "question", "message": "Mon plan : https://exemple.cm/plan"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        d = DemandeContact.objects.get()
        self.assertEqual((d.auteur, d.nom, d.email), (self.client_a, "Alice", "a@exemple.cm"))

    def test_client_rappel_exige_un_telephone(self):
        self.client.force_authenticate(self.client_a)
        r = self.client.post(URL, {"type": "rappel", "message": "Rappelez-moi"}, format="json")
        self.assertEqual((r.status_code, "telephone" in r.data), (400, True))
        r = self.client.post(URL, {"type": "rappel", "telephone": "699000000", "message": "Rappelez-moi"},
                             format="json")
        self.assertEqual(r.status_code, 201)

    def test_quota_par_compte(self):
        self.client.force_authenticate(self.client_a)
        for _i in range(10):
            DemandeContact.objects.create(auteur=self.client_a, nom="A", email="a@exemple.cm", message="Bonjour")
        r = self.client.post(URL, {"type": "question", "message": "Bonjour encore"}, format="json")
        self.assertEqual(r.status_code, 429)

    def test_jeton_invalide_ne_bloque_pas_un_visiteur(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer perime")
        self.assertEqual(self.client.post(URL, VISITEUR, format="json").status_code, 201)

    def test_messages_traduits(self):
        r = self.client.post(URL, {**VISITEUR, "message": "ok"}, format="json", HTTP_ACCEPT_LANGUAGE="de")
        self.assertIn("zwischen 5 und 1000", r.data["message"][0])


class SuiviEtEquipeTests(Base):
    def setUp(self):
        super().setUp()
        self.mienne = DemandeContact.objects.create(auteur=self.client_a, nom="Alice", email="a@exemple.cm",
                                                    message="Bonjour", produit=self.produit,
                                                    reponse_equipe="Voici", notes_internes="Secret")
        self.visiteur = DemandeContact.objects.create(nom="V", telephone="699000000", type="rappel",
                                                      creneau="matin", message="Rappel svp")

    def test_miennes(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{URL}miennes/").status_code, 401)
        self.client.force_authenticate(self.client_a)
        r = self.client.get(f"{URL}miennes/")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(set(r.data["results"][0]), {"id", "reference", "type", "creneau", "message", "produit",
                                                     "etat", "reponse_equipe", "cree_le", "traitee_le"})
        self.assertEqual(r.data["results"][0]["produit"], {"slug": self.produit.slug, "nom": "Sol"})
        self.assertNotIn("Secret", r.content.decode())
        self.assertEqual(self.client.get(URL).status_code, 405)  # pas de liste publique

    def test_equipe(self):
        self.client.force_authenticate(self.client_a)
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 403)
        self.client.force_authenticate(self.membre)
        r = self.client.get(URL_ADMIN)
        self.assertEqual(r.data["count"], 2)
        self.assertEqual(set(r.data["results"][0]) - set(r.data["results"][1]), set())
        for requete, nombre in {"type=rappel": 1, "etat=nouvelle": 2, "search=alice": 1, "search=699": 1}.items():
            self.assertEqual(self.client.get(f"{URL_ADMIN}?{requete}").data["count"], nombre, requete)
        d = self.client.get(f"{URL_ADMIN}{self.mienne.pk}/").data
        self.assertEqual((d["auteur"], d["notes_internes"], d["langue"]),
                         ({"id": self.client_a.pk, "nom_complet": "Alice"}, "Secret", "fr"))
        self.assertIsNone(self.client.get(f"{URL_ADMIN}{self.visiteur.pk}/").data["auteur"])
        self.assertEqual(self.client.get(f"{URL_ADMIN}resume/").data,
                         {"nouvelle": 2, "en_cours": 0, "traitee": 0, "total": 2})

    def test_traitee_le(self):
        self.client.force_authenticate(self.membre)
        r = self.client.patch(f"{URL_ADMIN}{self.mienne.pk}/", {"etat": "traitee", "reponse_equipe": "Fait"},
                              format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNotNone(r.data["traitee_le"])
        r = self.client.patch(f"{URL_ADMIN}{self.mienne.pk}/", {"etat": "en_cours"}, format="json")
        self.assertIsNone(r.data["traitee_le"])
        self.assertEqual(self.client.patch(f"{URL_ADMIN}{self.mienne.pk}/", {"etat": "zz"}, format="json")
                         .status_code, 400)
