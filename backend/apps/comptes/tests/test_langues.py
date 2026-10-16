"""Multilingue des comptes : messages de l'API dans la langue demandée (Accept-Language), langue préférée
du compte (inscription, profil, tableau de bord)."""
from django.core.cache import cache
from django.utils import translation
from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role

from .test_api import (ADRESSE, INSCRIPTION, MDP, URL_CLIENTS, URL_CONNEXION, URL_CONNEXION_EQUIPE, URL_EQUIPE,
                       URL_INSCRIPTION, URL_MOI, Base)


class LangueRemiseMixin:
    """Une requête active sa langue (LocaleMiddleware) ; on revient au français pour les tests suivants."""

    def setUp(self):
        super().setUp()
        self.addCleanup(translation.deactivate)


class MessagesTraduitsTests(LangueRemiseMixin, Base):
    def setUp(self):
        super().setUp()
        Utilisateur.objects.create_user("client@exemple.cm", MDP, nom_complet="Client Test", **ADRESSE)

    def test_erreur_de_connexion_dans_chaque_langue(self):
        attendus = {
            "": "E-mail ou mot de passe incorrect.",  # sans en-tête : français
            "fr-FR,fr;q=0.9": "E-mail ou mot de passe incorrect.",
            "en-US,en;q=0.9": "Incorrect email or password.",
            "zh-hans": "电子邮箱或密码错误。",
            "zh-CN": "电子邮箱或密码错误。",
            "de": "E-Mail-Adresse oder Passwort falsch.",
            "ja": "メールアドレスまたはパスワードが正しくありません。",
            "es-ES": "E-mail ou mot de passe incorrect.",  # langue non proposée : français
        }
        for entete, message in attendus.items():
            with self.subTest(entete=entete):
                cache.clear()  # pas de blocage après 5 essais incorrects
                extra = {"HTTP_ACCEPT_LANGUAGE": entete} if entete else {}
                r = self.connecter("client@exemple.cm", "mauvais-mot-de-passe", **extra)
                self.assertEqual(r.status_code, 401)
                self.assertEqual(r.data["detail"], message)

    def test_en_tetes_content_language_et_vary(self):
        r = self.connecter("client@exemple.cm", "faux", HTTP_ACCEPT_LANGUAGE="ja")
        self.assertEqual(r["Content-Language"], "ja")
        self.assertIn("Accept-Language", r["Vary"])

    def test_refus_du_tableau_de_bord_traduit(self):
        r = self.connecter("client@exemple.cm", url=URL_CONNEXION_EQUIPE, HTTP_ACCEPT_LANGUAGE="de")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["detail"], "Dieses Konto hat keinen Zugriff auf das Dashboard.")

    def test_validation_inscription_traduite(self):
        donnees = {**INSCRIPTION, "email": "client@exemple.cm", "ville": "  "}
        r = self.client.post(URL_INSCRIPTION, donnees, format="json", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.status_code, 400)
        # Message de DRF (champ vide) traduit par DRF lui-même
        self.assertEqual(str(r.data["ville"][0]), "This field may not be blank.")
        donnees["ville"] = "Douala"
        r = self.client.post(URL_INSCRIPTION, donnees, format="json", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.data["email"], ["An account already exists with this email address."])

    def test_validateurs_de_mot_de_passe_de_django_traduits(self):
        donnees = {**INSCRIPTION, "mot_de_passe": "12345678"}
        r = self.client.post(URL_INSCRIPTION, donnees, format="json", HTTP_ACCEPT_LANGUAGE="ja")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(all("パスワード" in m for m in r.data["mot_de_passe"]), r.data)

    def test_adresse_manquante_au_profil_traduite(self):
        jeton = self.connecter("client@exemple.cm").data["acces"]
        self.authentifier(jeton)
        r = self.client.patch(URL_MOI, {"quartier": ""}, format="json", HTTP_ACCEPT_LANGUAGE="zh-Hans")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["quartier"], ["街区为必填项。"])


class LanguePrefereeTests(LangueRemiseMixin, Base):
    def test_inscription_langue_explicite(self):
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "langue": "ja"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["utilisateur"]["langue"], "ja")
        self.assertEqual(Utilisateur.objects.get().langue, "ja")

    def test_inscription_langue_de_la_requete_par_defaut(self):
        r = self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json", HTTP_ACCEPT_LANGUAGE="zh-Hans")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["utilisateur"]["langue"], "zh")  # code court, comme le site

    def test_inscription_sans_langue_ni_en_tete_francais(self):
        r = self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json")
        self.assertEqual(r.data["utilisateur"]["langue"], "fr")

    def test_inscription_langue_refusee(self):
        for langue in ("es", "zh-hans", ""):
            with self.subTest(langue=langue):
                r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "langue": langue}, format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn("langue", r.data)
        self.assertFalse(Utilisateur.objects.exists())

    def test_profil_modifie_la_langue(self):
        r = self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json")
        self.authentifier(r.data["acces"])
        r = self.client.patch(URL_MOI, {"langue": "de"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["langue"], "de")
        self.assertEqual(Utilisateur.objects.get().langue, "de")
        r = self.client.patch(URL_MOI, {"langue": "klingon"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Utilisateur.objects.get().langue, "de")

    def test_comptes_existants_en_francais(self):
        u = Utilisateur.objects.create_user("ancien@exemple.cm", MDP, nom_complet="Ancien")
        self.assertEqual(u.langue, "fr")

    def test_tableau_de_bord_voit_la_langue_des_clients_et_des_membres(self):
        Utilisateur.objects.create_user("admin@cir.cm", MDP, nom_complet="Admin", role=Role.SUPER_ADMIN)
        client = Utilisateur.objects.create_user("c@exemple.cm", MDP, nom_complet="C", langue="en", **ADRESSE)
        self.authentifier(self.connecter("admin@cir.cm", url=URL_CONNEXION_EQUIPE).data["acces"])
        self.assertEqual(self.client.get(URL_CLIENTS).data["results"][0]["langue"], "en")
        self.assertEqual(self.client.get(f"{URL_CLIENTS}{client.pk}/").data["langue"], "en")
        r = self.client.post(URL_EQUIPE, {"email": "m@cir.cm", "nom_complet": "Membre", "mot_de_passe": MDP,
                                          "langue": "zh"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["langue"], "zh")
        self.assertNotIn("mot_de_passe", r.data)

    def test_connexion_renvoie_la_langue(self):
        Utilisateur.objects.create_user("c@exemple.cm", MDP, nom_complet="C", langue="ja", **ADRESSE)
        r = self.connecter("c@exemple.cm")
        self.assertEqual(r.data["utilisateur"]["langue"], "ja")
        self.assertEqual(URL_CONNEXION, "/api/comptes/connexion/")
