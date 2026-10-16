"""Tests d'API des comptes : /api/comptes/ (site public) et /api/admin/comptes/ (tableau de bord)."""
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role

MDP = "Resine-Epoxy-2026!"
ADRESSE = {"ville": "Douala", "quartier": "Bonapriso", "rue_ou_repere": "Près de la pharmacie"}
INSCRIPTION = {"email": "Awa@Exemple.cm", "mot_de_passe": MDP, "nom_complet": "Awa Test", **ADRESSE}

URL_INSCRIPTION = "/api/comptes/inscription/"
URL_CONNEXION = "/api/comptes/connexion/"
URL_RAFRAICHIR = "/api/comptes/connexion/rafraichir/"
URL_DECONNEXION = "/api/comptes/deconnexion/"
URL_MOI = "/api/comptes/moi/"
URL_CONNEXION_EQUIPE = "/api/admin/comptes/connexion/"
URL_EQUIPE = "/api/admin/comptes/equipe/"
URL_CLIENTS = "/api/admin/comptes/clients/"

CHAMPS_INTERDITS = {"password", "mot_de_passe", "is_superuser", "is_staff", "groups", "user_permissions"}


class Base(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def connecter(self, email, mot_de_passe=MDP, url=URL_CONNEXION, **extra):
        return self.client.post(url, {"email": email, "mot_de_passe": mot_de_passe}, format="json", **extra)

    def authentifier(self, jeton):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton}")

    def assert_sans_champs_sensibles(self, donnees):
        self.assertFalse(CHAMPS_INTERDITS & set(donnees), donnees)


# --- Inscription ---

class InscriptionApiTests(Base):
    def test_inscription_renvoie_profil_et_jetons(self):
        r = self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(set(r.data), {"utilisateur", "acces", "rafraichissement"})
        profil = r.data["utilisateur"]
        self.assert_sans_champs_sensibles(profil)
        self.assertEqual(profil["email"], "awa@exemple.cm")
        self.assertEqual(profil["role"], Role.CLIENT)
        self.assertFalse(profil["est_equipe"])
        self.assertTrue(profil["adresse_complete"])
        self.assertEqual(profil["adresse_formatee"], "Près de la pharmacie, Bonapriso, Douala")
        self.authentifier(r.data["acces"])
        self.assertEqual(self.client.get(URL_MOI).data["email"], "awa@exemple.cm")

    def test_champs_obligatoires(self):
        for champ in ("email", "mot_de_passe", "nom_complet", "ville", "quartier", "rue_ou_repere"):
            donnees = {k: v for k, v in INSCRIPTION.items() if k != champ}
            r = self.client.post(URL_INSCRIPTION, donnees, format="json")
            self.assertEqual(r.status_code, 400, champ)
            self.assertIn(champ, r.data)
        self.assertFalse(Utilisateur.objects.exists())

    def test_adresse_en_espaces_refusee(self):
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "rue_ou_repere": "   "}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("rue_ou_repere", r.data)

    def test_email_invalide(self):
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": "pas-un-email"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_email_deja_utilise(self):
        self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json")
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": "AWA@exemple.CM"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.data)
        self.assertEqual(Utilisateur.objects.count(), 1)

    def test_mot_de_passe_faible(self):
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "mot_de_passe": "12345678"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("mot_de_passe", r.data)

    def test_impossible_de_s_inscrire_dans_l_equipe(self):
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "role": "super_admin", "is_staff": True,
                                               "is_superuser": True}, format="json")
        self.assertEqual(r.status_code, 201)
        u = Utilisateur.objects.get()
        self.assertEqual(u.role, Role.CLIENT)
        self.assertFalse(u.is_staff or u.is_superuser)

    def test_quota_20_par_heure(self):
        for i in range(20):
            r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": f"u{i}@exemple.cm"}, format="json")
            self.assertEqual(r.status_code, 201, (i, r.content))
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": "u20@exemple.cm"}, format="json")
        self.assertEqual(r.status_code, 429)

    def test_quota_non_contournable_par_x_forwarded_for(self):
        """L'en-tête X-Forwarded-For est fourni par le client : changer sa valeur ne doit pas remettre le quota à zéro."""
        for i in range(20):
            self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": f"u{i}@exemple.cm"}, format="json",
                             HTTP_X_FORWARDED_FOR=f"10.0.0.{i}")
        r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": "u20@exemple.cm"}, format="json",
                             HTTP_X_FORWARDED_FOR="10.0.1.1")
        self.assertEqual(r.status_code, 429)


# --- Connexion, rafraîchissement, déconnexion ---

class ConnexionApiTests(Base):
    def setUp(self):
        super().setUp()
        self.u = Utilisateur.objects.create_user("awa@exemple.cm", MDP, nom_complet="Awa", **ADRESSE)

    def test_connexion_reussie(self):
        r = self.connecter(" AWA@Exemple.cm ")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(set(r.data), {"acces", "rafraichissement", "utilisateur"})
        self.assert_sans_champs_sensibles(r.data["utilisateur"])
        self.assertEqual(AccessToken(r.data["acces"])["role"], Role.CLIENT)
        self.u.refresh_from_db()
        self.assertIsNotNone(self.u.last_login)

    def test_mauvais_mot_de_passe_et_email_inconnu_meme_reponse(self):
        mauvais = self.connecter("awa@exemple.cm", "faux-mot-de-passe")
        inconnu = self.connecter("inconnu@exemple.cm")
        self.assertEqual(mauvais.status_code, 401)
        self.assertEqual(inconnu.status_code, 401)
        self.assertEqual(mauvais.data, inconnu.data)
        self.assertEqual(mauvais.data["detail"], "E-mail ou mot de passe incorrect.")

    def test_compte_desactive_meme_reponse_qu_un_mauvais_mot_de_passe(self):
        self.u.is_active = False
        self.u.save()
        r = self.connecter("awa@exemple.cm")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["detail"], "E-mail ou mot de passe incorrect.")

    def test_champ_manquant_400_non_compte_comme_essai(self):
        for _ in range(6):
            r = self.client.post(URL_CONNEXION, {"email": "awa@exemple.cm"}, format="json")
            self.assertEqual(r.status_code, 400)
            self.assertIn("mot_de_passe", r.data)
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 200)

    def test_ancien_champ_password_refuse(self):
        r = self.client.post(URL_CONNEXION, {"email": "awa@exemple.cm", "password": MDP}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_blocage_15_minutes_apres_5_echecs(self):
        for _ in range(5):
            self.assertEqual(self.connecter("awa@exemple.cm", "faux").status_code, 401)
        r = self.connecter("awa@exemple.cm")
        self.assertEqual(r.status_code, 429)
        self.assertIn("15 minutes", r.data["detail"])
        self.assertEqual(self.connecter("AWA@exemple.cm").status_code, 429)  # casse indifférente
        cache.clear()  # équivaut à l'expiration du délai
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 200)

    def test_succes_remet_le_compteur_a_zero(self):
        for _ in range(4):
            self.connecter("awa@exemple.cm", "faux")
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 200)
        for _ in range(4):
            self.assertEqual(self.connecter("awa@exemple.cm", "faux").status_code, 401)
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 200)

    def test_blocage_propre_a_chaque_email(self):
        Utilisateur.objects.create_user("autre@exemple.cm", MDP, nom_complet="Autre")
        for _ in range(5):
            self.connecter("awa@exemple.cm", "faux")
        self.assertEqual(self.connecter("autre@exemple.cm").status_code, 200)

    def test_blocage_non_contournable_par_x_forwarded_for(self):
        """BNF-01 : en changeant X-Forwarded-For à chaque essai, l'attaquant ne doit pas échapper au blocage."""
        for i in range(5):
            self.connecter("awa@exemple.cm", "faux", HTTP_X_FORWARDED_FOR=f"10.0.0.{i}")
        r = self.connecter("awa@exemple.cm", HTTP_X_FORWARDED_FOR="10.0.0.99")
        self.assertEqual(r.status_code, 429)

    def test_rafraichissement_avec_rotation(self):
        jetons = self.connecter("awa@exemple.cm").data
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(set(r.data), {"acces", "rafraichissement"})
        self.assertEqual(AccessToken(r.data["acces"])["role"], Role.CLIENT)
        # l'ancien jeton de rafraîchissement est passé en liste noire
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_rafraichissement_jeton_invalide(self):
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": "n-importe-quoi"}, format="json")
        self.assertEqual(r.status_code, 401)
        r = self.client.post(URL_RAFRAICHIR, {}, format="json")
        self.assertIn(r.status_code, (400, 401))

    def test_rafraichissement_refuse_avec_un_jeton_d_acces(self):
        jetons = self.connecter("awa@exemple.cm").data
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": jetons["acces"]}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_deconnexion_met_le_jeton_en_liste_noire(self):
        jetons = self.connecter("awa@exemple.cm").data
        r = self.client.post(URL_DECONNEXION, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 401)
        r = self.client.post(URL_DECONNEXION, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_compte_desactive_jetons_refuses(self):
        jetons = self.connecter("awa@exemple.cm").data
        self.u.is_active = False
        self.u.save()
        self.authentifier(jetons["acces"])
        self.assertEqual(self.client.get(URL_MOI).status_code, 401)
        self.client.credentials()
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 401)


# --- Profil ---

class MoiApiTests(Base):
    def setUp(self):
        super().setUp()
        self.u = Utilisateur.objects.create_user("awa@exemple.cm", MDP, nom_complet="Awa", **ADRESSE)
        self.client.force_authenticate(self.u)

    def test_anonyme_refuse(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL_MOI).status_code, 401)
        self.assertEqual(self.client.patch(URL_MOI, {"ville": "Yaoundé"}, format="json").status_code, 401)

    def test_jeton_invalide_refuse(self):
        self.client.force_authenticate(None)
        self.authentifier("faux.jeton.jwt")
        self.assertEqual(self.client.get(URL_MOI).status_code, 401)

    def test_lecture(self):
        r = self.client.get(URL_MOI)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data), {
            "id", "email", "nom_complet", "telephone", "role", "est_equipe", "ville", "quartier",
            "rue_ou_repere", "adresse_complete", "adresse_formatee", "date_inscription",
        })

    def test_modification_partielle(self):
        r = self.client.patch(URL_MOI, {"quartier": "  Akwa ", "telephone": "699 00 00 00"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["quartier"], "Akwa")
        self.u.refresh_from_db()
        self.assertEqual((self.u.quartier, self.u.ville, self.u.telephone), ("Akwa", "Douala", "699 00 00 00"))

    def test_put_se_comporte_comme_patch(self):
        r = self.client.put(URL_MOI, {"ville": "Kribi"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.u.refresh_from_db()
        self.assertEqual((self.u.ville, self.u.quartier, self.u.nom_complet), ("Kribi", "Bonapriso", "Awa"))

    def test_pas_d_elevation_de_role_ni_de_changement_d_email(self):
        r = self.client.patch(URL_MOI, {
            "role": "super_admin", "est_equipe": True, "is_staff": True, "is_superuser": True,
            "is_active": False, "email": "pirate@exemple.cm", "id": 999, "password": "x",
            "mot_de_passe": "Nouveau-Mdp-2026!", "date_inscription": "2000-01-01T00:00:00Z",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.u.refresh_from_db()
        self.assertEqual((self.u.role, self.u.email), (Role.CLIENT, "awa@exemple.cm"))
        self.assertFalse(self.u.is_staff or self.u.is_superuser)
        self.assertTrue(self.u.is_active)
        self.assertTrue(self.u.check_password(MDP))
        self.assertNotEqual(self.u.pk, 999)
        self.assertNotEqual(self.u.date_inscription.year, 2000)

    def test_adresse_et_nom_ne_peuvent_etre_vides(self):
        for donnees in ({"ville": "  "}, {"quartier": ""}, {"rue_ou_repere": None}, {"nom_complet": " "}):
            r = self.client.patch(URL_MOI, donnees, format="json")
            self.assertEqual(r.status_code, 400, donnees)
        self.u.refresh_from_db()
        self.assertTrue(self.u.adresse_complete)

    def test_longueur_maximale(self):
        r = self.client.patch(URL_MOI, {"ville": "x" * 81}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_membre_de_l_equipe_sans_adresse_peut_modifier_son_nom(self):
        membre = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="M", role=Role.MEMBRE)
        self.client.force_authenticate(membre)
        r = self.client.patch(URL_MOI, {"nom_complet": "Membre CIR"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.data["est_equipe"])
        self.assertFalse(r.data["adresse_complete"])

    def test_suppression_interdite(self):
        self.assertEqual(self.client.delete(URL_MOI).status_code, 405)


# --- Tableau de bord ---

class EquipeBase(Base):
    def setUp(self):
        super().setUp()
        self.admin = Utilisateur.objects.create_superuser("admin@cir.cm", MDP, nom_complet="Admin")
        self.membre = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="Membre", role=Role.MEMBRE)
        self.client_cir = Utilisateur.objects.create_user("c@exemple.cm", MDP, nom_complet="Client", **ADRESSE)


class ConnexionEquipeApiTests(EquipeBase):
    def test_membre_et_super_admin_acceptes(self):
        for email, role in (("m@cir.cm", Role.MEMBRE), ("admin@cir.cm", Role.SUPER_ADMIN)):
            r = self.connecter(email, url=URL_CONNEXION_EQUIPE)
            self.assertEqual(r.status_code, 200, r.content)
            self.assertEqual(r.data["utilisateur"]["role"], role)
            self.assertTrue(r.data["utilisateur"]["est_equipe"])

    def test_client_refuse(self):
        r = self.connecter("c@exemple.cm", url=URL_CONNEXION_EQUIPE)
        self.assertEqual(r.status_code, 403)
        self.assertNotIn("acces", r.data)
        self.assertIn("tableau de bord", r.data["detail"])

    def test_mauvais_mot_de_passe_401(self):
        self.assertEqual(self.connecter("m@cir.cm", "faux", url=URL_CONNEXION_EQUIPE).status_code, 401)

    def test_membre_desactive_refuse(self):
        self.membre.is_active = False
        self.membre.save()
        self.assertEqual(self.connecter("m@cir.cm", url=URL_CONNEXION_EQUIPE).status_code, 401)

    def test_blocage_apres_5_echecs(self):
        for _ in range(5):
            self.connecter("m@cir.cm", "faux", url=URL_CONNEXION_EQUIPE)
        self.assertEqual(self.connecter("m@cir.cm", url=URL_CONNEXION_EQUIPE).status_code, 429)


class EquipeApiTests(EquipeBase):
    def test_reserve_au_super_admin(self):
        self.assertEqual(self.client.get(URL_EQUIPE).status_code, 401)
        for u in (self.client_cir, self.membre):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(URL_EQUIPE).status_code, 403)
            self.assertEqual(self.client.post(URL_EQUIPE, {
                "email": "x@cir.cm", "nom_complet": "X", "mot_de_passe": MDP}, format="json").status_code, 403)
            self.assertEqual(self.client.post(f"{URL_EQUIPE}{self.admin.pk}/desactiver/").status_code, 403)
        self.assertFalse(Utilisateur.objects.filter(email="x@cir.cm").exists())

    def test_super_admin_desactive_refuse(self):
        Utilisateur.objects.create_superuser("s2@cir.cm", MDP, nom_complet="S2")
        self.admin.is_active = False
        self.admin.save()
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(URL_EQUIPE).status_code, 403)

    def test_liste_uniquement_l_equipe(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get(URL_EQUIPE)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        self.assertEqual([m["nom_complet"] for m in r.data["results"]], ["Admin", "Membre"])
        for m in r.data["results"]:
            self.assert_sans_champs_sensibles(m)
            self.assertEqual(set(m), {"id", "email", "nom_complet", "telephone", "role", "actif",
                                      "date_inscription", "derniere_connexion"})
        self.assertEqual(self.client.get(f"{URL_EQUIPE}{self.client_cir.pk}/").status_code, 404)

    def test_filtres_et_recherche(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(URL_EQUIPE, {"role": "membre"}).data["count"], 1)
        self.assertEqual(self.client.get(URL_EQUIPE, {"search": "admin@"}).data["count"], 1)
        self.membre.is_active = False
        self.membre.save()
        self.assertEqual(self.client.get(URL_EQUIPE, {"is_active": "false"}).data["count"], 1)

    def test_ajout_d_un_membre(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(URL_EQUIPE, {"email": " Nouveau@CIR.cm", "nom_complet": "Nouveau",
                                          "mot_de_passe": MDP, "telephone": "699"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assert_sans_champs_sensibles(r.data)
        self.assertEqual((r.data["email"], r.data["role"], r.data["actif"]), ("nouveau@cir.cm", "membre", True))
        u = Utilisateur.objects.get(email="nouveau@cir.cm")
        self.assertTrue(u.check_password(MDP))
        self.assertTrue(u.is_staff)
        self.assertEqual(self.connecter("nouveau@cir.cm", url=URL_CONNEXION_EQUIPE).status_code, 200)

    def test_ajout_d_un_super_admin(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(URL_EQUIPE, {"email": "s@cir.cm", "nom_complet": "S", "mot_de_passe": MDP,
                                          "role": "super_admin"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(Utilisateur.objects.get(email="s@cir.cm").is_superuser)

    def test_ajout_refuse(self):
        self.client.force_authenticate(self.admin)
        cas = [
            {"email": "x@cir.cm", "nom_complet": "X", "mot_de_passe": MDP, "role": "client"},
            {"email": "C@EXEMPLE.cm", "nom_complet": "X", "mot_de_passe": MDP},
            {"email": "x@cir.cm", "nom_complet": "X", "mot_de_passe": "1234"},
            {"email": "x@cir.cm", "nom_complet": " ", "mot_de_passe": MDP},
            {"email": "x@cir.cm", "nom_complet": "X"},
            {"email": "pas-un-email", "nom_complet": "X", "mot_de_passe": MDP},
        ]
        for donnees in cas:
            self.assertEqual(self.client.post(URL_EQUIPE, donnees, format="json").status_code, 400, donnees)
        self.assertFalse(Utilisateur.objects.filter(email="x@cir.cm").exists())
        self.assertEqual(Utilisateur.objects.get(email="c@exemple.cm").role, Role.CLIENT)

    def test_actif_non_modifiable_a_la_creation(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(URL_EQUIPE, {"email": "x@cir.cm", "nom_complet": "X", "mot_de_passe": MDP,
                                          "actif": False, "is_superuser": True}, format="json")
        self.assertEqual(r.status_code, 201)
        u = Utilisateur.objects.get(email="x@cir.cm")
        self.assertTrue(u.is_active)
        self.assertFalse(u.is_superuser)

    def test_pas_de_modification_ni_de_suppression(self):
        self.client.force_authenticate(self.admin)
        url = f"{URL_EQUIPE}{self.membre.pk}/"
        self.assertEqual(self.client.patch(url, {"role": "super_admin"}, format="json").status_code, 405)
        self.assertEqual(self.client.put(url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(url).status_code, 405)
        self.membre.refresh_from_db()
        self.assertEqual(self.membre.role, Role.MEMBRE)

    def test_desactivation_et_reactivation(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"{URL_EQUIPE}{self.membre.pk}/desactiver/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["actif"])
        self.assertEqual(self.connecter("m@cir.cm", url=URL_CONNEXION_EQUIPE).status_code, 401)
        r = self.client.post(f"{URL_EQUIPE}{self.membre.pk}/reactiver/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["actif"])
        self.assertEqual(self.connecter("m@cir.cm", url=URL_CONNEXION_EQUIPE).status_code, 200)

    def test_jetons_d_un_membre_desactive_refuses(self):
        jetons = self.connecter("m@cir.cm", url=URL_CONNEXION_EQUIPE).data
        self.client.force_authenticate(self.admin)
        self.client.post(f"{URL_EQUIPE}{self.membre.pk}/desactiver/")
        self.client.force_authenticate(None)
        self.authentifier(jetons["acces"])
        self.assertEqual(self.client.get(URL_CLIENTS).status_code, 401)
        self.client.credentials()
        r = self.client.post(URL_RAFRAICHIR, {"rafraichissement": jetons["rafraichissement"]}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_pas_d_auto_desactivation(self):
        Utilisateur.objects.create_superuser("s2@cir.cm", MDP, nom_complet="S2")
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"{URL_EQUIPE}{self.admin.pk}/desactiver/")
        self.assertEqual(r.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_desactiver_un_autre_super_admin(self):
        s2 = Utilisateur.objects.create_superuser("s2@cir.cm", MDP, nom_complet="S2")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"{URL_EQUIPE}{s2.pk}/desactiver/").status_code, 200)
        s2.refresh_from_db()
        self.assertFalse(s2.is_active)
        self.client.force_authenticate(s2)
        self.assertEqual(self.client.get(URL_EQUIPE).status_code, 403)  # s2 désactivé n'a plus accès

    def test_client_introuvable_dans_l_equipe(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"{URL_EQUIPE}{self.client_cir.pk}/desactiver/").status_code, 404)
        self.assertEqual(self.client.post(f"{URL_EQUIPE}{self.client_cir.pk}/reactiver/").status_code, 404)
        self.client_cir.refresh_from_db()
        self.assertTrue(self.client_cir.is_active)


class ClientsApiTests(EquipeBase):
    def setUp(self):
        super().setUp()
        self.sans_adresse = Utilisateur.objects.create_user("s@exemple.cm", MDP, nom_complet="Sans Adresse",
                                                            ville="Yaoundé")

    def test_reserve_a_l_equipe(self):
        self.assertEqual(self.client.get(URL_CLIENTS).status_code, 401)
        self.client.force_authenticate(self.client_cir)
        self.assertEqual(self.client.get(URL_CLIENTS).status_code, 403)
        self.assertEqual(self.client.get(f"{URL_CLIENTS}{self.client_cir.pk}/").status_code, 403)
        for u in (self.membre, self.admin):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(URL_CLIENTS).status_code, 200)

    def test_liste_uniquement_les_clients(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get(URL_CLIENTS)
        self.assertEqual(r.data["count"], 2)
        emails = {c["email"] for c in r.data["results"]}
        self.assertEqual(emails, {"c@exemple.cm", "s@exemple.cm"})
        for c in r.data["results"]:
            self.assert_sans_champs_sensibles(c)
        self.assertEqual(self.client.get(f"{URL_CLIENTS}{self.membre.pk}/").status_code, 404)

    def test_detail(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get(f"{URL_CLIENTS}{self.client_cir.pk}/")
        self.assertEqual(r.status_code, 200)
        self.assert_sans_champs_sensibles(r.data)
        self.assertEqual(r.data["rue_ou_repere"], "Près de la pharmacie")
        self.assertEqual(r.data["adresse_formatee"], "Près de la pharmacie, Bonapriso, Douala")
        self.assertIn("derniere_connexion", r.data)

    def test_filtre_adresse_complete(self):
        self.client.force_authenticate(self.membre)
        for valeur, attendu in (("1", "c@exemple.cm"), ("oui", "c@exemple.cm"), ("0", "s@exemple.cm"),
                                ("false", "s@exemple.cm")):
            r = self.client.get(URL_CLIENTS, {"adresse_complete": valeur})
            self.assertEqual([c["email"] for c in r.data["results"]], [attendu], valeur)
        self.assertEqual(self.client.get(URL_CLIENTS, {"adresse_complete": "peut-etre"}).data["count"], 2)

    def test_filtres_ville_actif_et_recherche(self):
        self.client.force_authenticate(self.membre)
        self.assertEqual(self.client.get(URL_CLIENTS, {"ville": "Douala"}).data["count"], 1)
        self.assertEqual(self.client.get(URL_CLIENTS, {"search": "bonapriso"}).data["count"], 1)
        self.sans_adresse.is_active = False
        self.sans_adresse.save()
        self.assertEqual(self.client.get(URL_CLIENTS, {"is_active": "true"}).data["count"], 1)

    def test_tri(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get(URL_CLIENTS, {"ordering": "nom_complet"})
        self.assertEqual([c["nom_complet"] for c in r.data["results"]], ["Client", "Sans Adresse"])

    def test_lecture_seule(self):
        self.client.force_authenticate(self.admin)
        url = f"{URL_CLIENTS}{self.client_cir.pk}/"
        self.assertEqual(self.client.post(URL_CLIENTS, {"email": "z@exemple.cm"}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(url, {"role": "membre"}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(url).status_code, 405)
        self.client_cir.refresh_from_db()
        self.assertEqual(self.client_cir.role, Role.CLIENT)


# --- Corrections de sécurité (commit 00623fb) ---

class AdresseIpTests(APITestCase):
    def ip(self, **meta):
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory
        from apps.comptes.views import adresse_ip
        return adresse_ip(Request(APIRequestFactory().get("/", **meta)))

    def test_sans_proxy_x_forwarded_for_ignore(self):
        self.assertEqual(self.ip(REMOTE_ADDR="9.9.9.9", HTTP_X_FORWARDED_FOR="1.1.1.1"), "9.9.9.9")

    def test_un_proxy_prend_la_valeur_ajoutee_par_le_proxy(self):
        from django.conf import settings
        from django.test import override_settings
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            self.assertEqual(self.ip(REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR="6.6.6.6, 41.202.1.2"),
                             "41.202.1.2")
            self.assertEqual(self.ip(REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR="41.202.1.2"), "41.202.1.2")


class CompteurIpApiTests(Base):
    def setUp(self):
        super().setUp()
        self.u = Utilisateur.objects.create_user("awa@exemple.cm", MDP, nom_complet="Awa")

    def test_vingt_echecs_sur_des_comptes_differents_bloquent_l_adresse(self):
        for i in range(19):
            self.assertEqual(self.connecter(f"inconnu{i}@exemple.cm", "faux").status_code, 401)
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 200)  # 19 échecs : encore permis
        self.connecter("inconnu19@exemple.cm", "faux")
        r = self.connecter("awa@exemple.cm")
        self.assertEqual(r.status_code, 429)
        # une autre adresse n'est pas concernée
        self.assertEqual(self.connecter("awa@exemple.cm", REMOTE_ADDR="10.9.9.9").status_code, 200)

    def test_succes_ne_remet_pas_le_compteur_ip_a_zero(self):
        for i in range(10):
            self.connecter(f"a{i}@exemple.cm", "faux")
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 200)
        for i in range(10):
            self.connecter(f"b{i}@exemple.cm", "faux")
        self.assertEqual(self.connecter("awa@exemple.cm").status_code, 429)

    def test_blocage_par_email_quelle_que_soit_l_adresse(self):
        for i in range(5):
            self.connecter("awa@exemple.cm", "faux", REMOTE_ADDR=f"10.0.0.{i}")
        self.assertEqual(self.connecter("awa@exemple.cm", REMOTE_ADDR="10.0.0.99").status_code, 429)

    def test_blocage_partage_entre_site_et_tableau_de_bord(self):
        membre = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="M", role=Role.MEMBRE)
        for _ in range(3):
            self.connecter("m@cir.cm", "faux")
        for _ in range(2):
            self.connecter("m@cir.cm", "faux", url=URL_CONNEXION_EQUIPE)
        self.assertEqual(self.connecter(membre.email, url=URL_CONNEXION_EQUIPE).status_code, 429)
        self.assertEqual(self.connecter(membre.email).status_code, 429)

    def test_derriere_un_proxy_x_forwarded_for_falsifie_sans_effet(self):
        from django.conf import settings
        from django.test import override_settings
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            for i in range(20):
                self.connecter(f"x{i}@exemple.cm", "faux", HTTP_X_FORWARDED_FOR=f"6.6.6.{i}, 41.202.1.2")
            r = self.connecter("awa@exemple.cm", HTTP_X_FORWARDED_FOR="7.7.7.7, 41.202.1.2")
            self.assertEqual(r.status_code, 429)
            r = self.connecter("awa@exemple.cm", HTTP_X_FORWARDED_FOR="41.202.1.3")
            self.assertEqual(r.status_code, 200)


class InscriptionCorrectionsApiTests(Base):
    def test_vieux_jeton_n_empeche_pas_l_inscription(self):
        self.authentifier("jeton.expire.invalide")
        r = self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_doublon_concurrent_400_et_non_500(self):
        from unittest import mock
        from apps.comptes import services
        Utilisateur.objects.create_user("awa@exemple.cm", MDP, nom_complet="Awa")
        with mock.patch.object(services, "verifier_email_disponible", side_effect=services.normaliser_email):
            r = self.client.post(URL_INSCRIPTION, INSCRIPTION, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("email", r.data)

    def test_quota_derriere_un_proxy(self):
        from django.conf import settings
        from django.test import override_settings
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            for i in range(20):
                self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": f"u{i}@exemple.cm"}, format="json",
                                 HTTP_X_FORWARDED_FOR=f"6.6.6.{i}, 41.202.1.2")
            r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": "u20@exemple.cm"}, format="json",
                                 HTTP_X_FORWARDED_FOR="7.7.7.7, 41.202.1.2")
            self.assertEqual(r.status_code, 429)
            r = self.client.post(URL_INSCRIPTION, {**INSCRIPTION, "email": "u21@exemple.cm"}, format="json",
                                 HTTP_X_FORWARDED_FOR="41.202.1.3")
            self.assertEqual(r.status_code, 201)


class FiltreVilleApiTests(EquipeBase):
    def test_ville_insensible_a_la_casse_et_exacte(self):
        Utilisateur.objects.create_user("y@exemple.cm", MDP, nom_complet="Y", ville="Douala-Bassa")
        self.client.force_authenticate(self.membre)
        for valeur in ("douala", " DOUALA ", "Douala"):
            r = self.client.get(URL_CLIENTS, {"ville": valeur})
            self.assertEqual([c["email"] for c in r.data["results"]], ["c@exemple.cm"], valeur)
        self.assertEqual(self.client.get(URL_CLIENTS, {"ville": "  "}).data["count"], 2)
