"""Tests des règles métier des comptes (services.py, adresses.py, jwt.py)."""

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.comptes import services
from apps.comptes.adresses import adresse_est_complete, nettoyer, valider_adresse
from apps.comptes.jwt import jetons_pour
from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role

MDP = "Resine-Epoxy-2026!"
ADRESSE = {"ville": "Douala", "quartier": "Bonapriso", "rue_ou_repere": "Près de la pharmacie"}


def inscrire(**champs):
    donnees = {"email": "awa@exemple.cm", "mot_de_passe": MDP, "nom_complet": "Awa Test", **ADRESSE}
    donnees.update(champs)
    return services.inscrire_client(**donnees)


class AdressesTests(TestCase):
    def test_nettoyer(self):
        self.assertEqual(nettoyer("  Rue   de la\tJoie \n"), "Rue de la Joie")
        self.assertEqual(nettoyer(None), "")

    def test_adresse_est_complete(self):
        self.assertTrue(adresse_est_complete("Douala", "Akwa", "Rue"))
        self.assertFalse(adresse_est_complete("Douala", " ", "Rue"))
        self.assertFalse(adresse_est_complete(None, "Akwa", "Rue"))

    def test_valider_adresse_complete(self):
        self.assertEqual(valider_adresse({**ADRESSE, "ville": "  Douala  ", "autre": "x"}), ADRESSE)

    def test_valider_adresse_signale_chaque_champ_vide(self):
        with self.assertRaises(ValidationError) as ctx:
            valider_adresse({"ville": " "})
        self.assertEqual(set(ctx.exception.detail), {"ville", "quartier", "rue_ou_repere"})

    def test_valider_adresse_partielle(self):
        self.assertEqual(valider_adresse({"quartier": " Akwa "}, partielle=True), {"quartier": "Akwa"})
        self.assertEqual(valider_adresse({}, partielle=True), {})
        with self.assertRaises(ValidationError):
            valider_adresse({"ville": ""}, partielle=True)


class InscriptionServiceTests(TestCase):
    def test_cree_un_client_avec_adresse(self):
        u = inscrire(email=" AWA@Exemple.cm ", nom_complet="  Awa   Test ", telephone=" 6 99 ")
        self.assertEqual(u.email, "awa@exemple.cm")
        self.assertEqual(u.nom_complet, "Awa Test")
        self.assertEqual(u.telephone, "6 99")
        self.assertEqual(u.role, Role.CLIENT)
        self.assertTrue(u.adresse_complete)
        self.assertTrue(u.check_password(MDP))

    def test_role_impose_client(self):
        u = inscrire(role=Role.SUPER_ADMIN)
        self.assertEqual(u.role, Role.CLIENT)
        self.assertFalse(u.is_staff or u.is_superuser)

    def test_email_deja_pris_sans_tenir_compte_de_la_casse(self):
        inscrire()
        with self.assertRaises(ValidationError) as ctx:
            inscrire(email="AWA@EXEMPLE.CM")
        self.assertIn("email", ctx.exception.detail)

    def test_adresse_incomplete_refusee(self):
        for champ in ADRESSE:
            with self.subTest(champ=champ), self.assertRaises(ValidationError):
                inscrire(**{champ: "   "})
        self.assertFalse(Utilisateur.objects.exists())

    def test_nom_vide_refuse(self):
        with self.assertRaises(ValidationError) as ctx:
            inscrire(nom_complet="   ")
        self.assertIn("nom_complet", ctx.exception.detail)

    def test_mot_de_passe_faible_refuse(self):
        for faible in ("court1", "12345678901", "password", "awa@exemple.cm"):
            with self.subTest(mot_de_passe=faible), self.assertRaises(ValidationError) as ctx:
                inscrire(mot_de_passe=faible)
            self.assertIn("mot_de_passe", ctx.exception.detail)
        self.assertFalse(Utilisateur.objects.exists())


class ProfilServiceTests(TestCase):
    def setUp(self):
        self.u = inscrire()

    def test_modifie_les_champs_autorises(self):
        services.mettre_a_jour_profil(self.u, {"nom_complet": " Awa  N. ", "telephone": " 677 ", "quartier": " Akwa "})
        self.u.refresh_from_db()
        self.assertEqual((self.u.nom_complet, self.u.telephone, self.u.quartier), ("Awa N.", "677", "Akwa"))
        self.assertEqual(self.u.ville, "Douala")

    def test_ignore_email_role_et_drapeaux(self):
        services.mettre_a_jour_profil(self.u, {
            "email": "pirate@exemple.cm", "role": Role.SUPER_ADMIN, "is_staff": True,
            "is_superuser": True, "is_active": False, "password": "x",
        })
        self.u.refresh_from_db()
        self.assertEqual(self.u.email, "awa@exemple.cm")
        self.assertEqual(self.u.role, Role.CLIENT)
        self.assertFalse(self.u.is_staff or self.u.is_superuser)
        self.assertTrue(self.u.is_active)
        self.assertTrue(self.u.check_password(MDP))

    def test_refuse_de_vider_l_adresse_ou_le_nom(self):
        for donnees in ({"ville": ""}, {"rue_ou_repere": "  "}, {"nom_complet": " "}):
            with self.subTest(donnees=donnees), self.assertRaises(ValidationError):
                services.mettre_a_jour_profil(self.u, donnees)
        self.u.refresh_from_db()
        self.assertTrue(self.u.adresse_complete)

    def test_sans_modification(self):
        self.assertIs(services.mettre_a_jour_profil(self.u, {}), self.u)


class PeutCommanderTests(TestCase):
    def test_regle_compte_et_adresse(self):
        u = inscrire()
        self.assertTrue(services.peut_commander(u))
        u.quartier = ""
        self.assertFalse(services.peut_commander(u))
        u.quartier = "Akwa"
        u.is_active = False
        self.assertFalse(services.peut_commander(u))
        self.assertFalse(services.peut_commander(AnonymousUser()))
        self.assertFalse(services.peut_commander(None))


class EquipeServiceTests(TestCase):
    def setUp(self):
        self.admin = Utilisateur.objects.create_superuser("admin@cir.cm", MDP, nom_complet="Admin")
        self.membre = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="Membre", role=Role.MEMBRE)
        self.client_cir = inscrire(email="c@exemple.cm")

    def ajouter(self, demandeur=None, **champs):
        donnees = {"email": "nouveau@cir.cm", "mot_de_passe": MDP, "nom_complet": "Nouveau"}
        donnees.update(champs)
        return services.ajouter_membre(demandeur or self.admin, **donnees)

    def test_ajouter_membre(self):
        u = self.ajouter(email=" Nouveau@CIR.cm ", telephone=" 699 ")
        self.assertEqual((u.email, u.role, u.telephone), ("nouveau@cir.cm", Role.MEMBRE, "699"))
        self.assertTrue(u.is_staff)
        self.assertFalse(u.is_superuser)

    def test_ajouter_super_admin(self):
        self.assertTrue(self.ajouter(role=Role.SUPER_ADMIN).is_superuser)

    def test_ajouter_reserve_au_super_admin(self):
        for demandeur in (self.membre, self.client_cir, AnonymousUser()):
            with self.subTest(demandeur=demandeur), self.assertRaises(PermissionDenied):
                self.ajouter(demandeur)
        with self.assertRaises(PermissionDenied):
            services.ajouter_membre(None, email="x@cir.cm", mot_de_passe=MDP, nom_complet="X")

    def test_ajouter_role_client_refuse(self):
        with self.assertRaises(ValidationError):
            self.ajouter(role=Role.CLIENT)

    def test_ajouter_email_existant_refuse(self):
        with self.assertRaises(ValidationError):
            self.ajouter(email="C@Exemple.cm")

    def test_ajouter_mot_de_passe_faible_refuse(self):
        with self.assertRaises(ValidationError):
            self.ajouter(mot_de_passe="1234")
        self.assertFalse(Utilisateur.objects.filter(email="nouveau@cir.cm").exists())

    def test_desactiver_membre(self):
        services.desactiver_membre(self.admin, self.membre)
        self.membre.refresh_from_db()
        self.assertFalse(self.membre.is_active)
        self.assertTrue(Utilisateur.objects.filter(pk=self.membre.pk).exists())  # compte conservé

    def test_desactiver_reserve_au_super_admin(self):
        autre = self.ajouter()
        with self.assertRaises(PermissionDenied):
            services.desactiver_membre(self.membre, autre)

    def test_pas_d_auto_desactivation(self):
        second = self.ajouter(role=Role.SUPER_ADMIN)
        with self.assertRaises(ValidationError):
            services.desactiver_membre(self.admin, self.admin)
        self.assertTrue(second.is_active)

    def test_desactiver_un_autre_super_admin_permis(self):
        second = self.ajouter(role=Role.SUPER_ADMIN)
        services.desactiver_membre(self.admin, second)
        second.refresh_from_db()
        self.assertFalse(second.is_active)

    def test_dernier_super_admin_actif_protege(self):
        """Appel direct du service : la cible est le seul super-admin actif restant."""
        demandeur = Utilisateur.objects.create_user("i@cir.cm", MDP, nom_complet="I", role=Role.SUPER_ADMIN,
                                                    is_active=False)
        with self.assertRaises(ValidationError) as ctx:
            services.desactiver_membre(demandeur, self.admin)
        self.assertIn("super-administrateur", str(ctx.exception.detail))
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_desactiver_client_refuse(self):
        with self.assertRaises(ValidationError):
            services.desactiver_membre(self.admin, self.client_cir)
        with self.assertRaises(ValidationError):
            services.reactiver_membre(self.admin, self.client_cir)

    def test_reactiver(self):
        services.desactiver_membre(self.admin, self.membre)
        services.reactiver_membre(self.admin, self.membre)
        self.membre.refresh_from_db()
        self.assertTrue(self.membre.is_active)
        with self.assertRaises(PermissionDenied):
            services.reactiver_membre(self.membre, self.membre)


class BlocageConnexionTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_cle_normalisee(self):
        self.assertEqual(services.cle_connexion(" A@B.cm ", "1.2.3.4"), "cir:connexion:a@b.cm:1.2.3.4")

    def test_bloque_apres_cinq_echecs(self):
        cle = services.cle_connexion("a@b.cm", "1.2.3.4")
        for _ in range(4):
            services.enregistrer_echec_connexion(cle)
        self.assertFalse(services.connexion_bloquee(cle))
        services.enregistrer_echec_connexion(cle)
        self.assertTrue(services.connexion_bloquee(cle))
        services.reinitialiser_essais_connexion(cle)
        self.assertFalse(services.connexion_bloquee(cle))

    @override_settings(CONNEXION_ESSAIS_MAX=2)
    def test_seuil_configurable(self):
        cle = "cir:test"
        services.enregistrer_echec_connexion(cle)
        services.enregistrer_echec_connexion(cle)
        self.assertTrue(services.connexion_bloquee(cle))

    def test_duree_du_blocage(self):
        from unittest import mock
        with mock.patch.object(services.cache, "set") as fixer, \
                mock.patch.object(services.cache, "incr", side_effect=ValueError):
            services.enregistrer_echec_connexion("cle")
        fixer.assert_called_once_with("cle", 1, 15 * 60)


class JetonsTests(TestCase):
    def test_jetons_pour_contient_role_et_nom(self):
        u = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="Membre", role=Role.MEMBRE)
        jetons = jetons_pour(u)
        self.assertEqual(set(jetons), {"acces", "rafraichissement"})
        acces = AccessToken(jetons["acces"])
        self.assertEqual((acces["role"], acces["nom_complet"]), ("membre", "Membre"))
        self.assertEqual(str(acces["user_id"]), str(u.pk))
        self.assertEqual(RefreshToken(jetons["rafraichissement"])["role"], "membre")
