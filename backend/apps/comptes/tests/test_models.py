"""Tests du modèle Utilisateur et de son gestionnaire."""
from django.db import IntegrityError
from django.test import TestCase

from apps.comptes.models import Utilisateur
from apps.comptes.roles import ROLES_EQUIPE, Role, est_role_equipe

MDP = "Resine-Epoxy-2026!"


class GestionnaireTests(TestCase):
    def test_create_user_client_par_defaut(self):
        u = Utilisateur.objects.create_user("  Awa@Exemple.CM ", MDP, nom_complet="Awa")
        self.assertEqual(u.email, "awa@exemple.cm")
        self.assertEqual(u.role, Role.CLIENT)
        self.assertTrue(u.is_active)
        self.assertFalse(u.is_staff)
        self.assertFalse(u.is_superuser)

    def test_mot_de_passe_hache(self):
        u = Utilisateur.objects.create_user("a@exemple.cm", MDP, nom_complet="A")
        self.assertNotEqual(u.password, MDP)
        self.assertNotIn(MDP, u.password)
        self.assertTrue(u.check_password(MDP))

    def test_sans_mot_de_passe_inutilisable(self):
        u = Utilisateur.objects.create_user("a@exemple.cm", nom_complet="A")
        self.assertFalse(u.has_usable_password())

    def test_email_obligatoire(self):
        with self.assertRaises(ValueError):
            Utilisateur.objects.create_user("", MDP, nom_complet="A")

    def test_email_unique_sans_tenir_compte_de_la_casse(self):
        Utilisateur.objects.create_user("a@exemple.cm", MDP, nom_complet="A")
        with self.assertRaises(IntegrityError):
            Utilisateur.objects.create_user("A@EXEMPLE.CM", MDP, nom_complet="A bis")

    def test_create_superuser_force_le_role(self):
        u = Utilisateur.objects.create_superuser("admin@cir.cm", MDP, nom_complet="Admin", role=Role.CLIENT)
        self.assertEqual(u.role, Role.SUPER_ADMIN)
        self.assertTrue(u.is_staff and u.is_superuser)

    def test_equipe_et_clients(self):
        c = Utilisateur.objects.create_user("c@exemple.cm", MDP, nom_complet="C")
        m = Utilisateur.objects.create_user("m@cir.cm", MDP, nom_complet="M", role=Role.MEMBRE)
        s = Utilisateur.objects.create_superuser("s@cir.cm", MDP, nom_complet="S")
        self.assertEqual(set(Utilisateur.objects.equipe()), {m, s})
        self.assertEqual(set(Utilisateur.objects.clients()), {c})


class UtilisateurTests(TestCase):
    def creer(self, **champs):
        champs.setdefault("nom_complet", "Awa Test")
        return Utilisateur.objects.create_user(champs.pop("email", "awa@exemple.cm"), MDP, **champs)

    def test_drapeaux_recalcules_selon_le_role(self):
        u = self.creer()
        u.is_staff = True
        u.is_superuser = True
        u.save()
        u.refresh_from_db()
        self.assertFalse(u.is_staff or u.is_superuser)

        u.role = Role.MEMBRE
        u.save()
        u.refresh_from_db()
        self.assertTrue(u.is_staff)
        self.assertFalse(u.is_superuser)

        u.role = Role.SUPER_ADMIN
        u.save()
        u.refresh_from_db()
        self.assertTrue(u.is_staff and u.is_superuser)

    def test_update_fields_role_entraine_les_drapeaux(self):
        u = self.creer()
        u.role = Role.SUPER_ADMIN
        u.save(update_fields=["role"])
        u.refresh_from_db()
        self.assertTrue(u.is_staff and u.is_superuser)
        u.role = Role.CLIENT
        u.save(update_fields=["role"])
        u.refresh_from_db()
        self.assertFalse(u.is_staff or u.is_superuser)

    def test_update_fields_sans_role_inchange(self):
        u = self.creer(role=Role.MEMBRE)
        u.is_active = False
        u.save(update_fields=["is_active"])
        u.refresh_from_db()
        self.assertFalse(u.is_active)
        self.assertTrue(u.is_staff)

    def test_email_normalise_a_l_enregistrement(self):
        u = self.creer()
        u.email = "  NOUVEAU@Exemple.cm "
        u.save()
        u.refresh_from_db()
        self.assertEqual(u.email, "nouveau@exemple.cm")

    def test_proprietes_de_role(self):
        self.assertFalse(self.creer().est_equipe)
        m = self.creer(email="m@cir.cm", role=Role.MEMBRE)
        self.assertTrue(m.est_equipe)
        self.assertFalse(m.est_super_admin)
        s = self.creer(email="s@cir.cm", role=Role.SUPER_ADMIN)
        self.assertTrue(s.est_equipe and s.est_super_admin)

    def test_adresse_complete(self):
        u = self.creer(ville="Douala", quartier="Akwa", rue_ou_repere="Rue Joss")
        self.assertTrue(u.adresse_complete)
        for champ in ("ville", "quartier", "rue_ou_repere"):
            with self.subTest(champ=champ):
                setattr(u, champ, "   ")
                self.assertFalse(u.adresse_complete)
                setattr(u, champ, "X")

    def test_adresse_vide_par_defaut(self):
        self.assertFalse(self.creer().adresse_complete)

    def test_adresse_formatee(self):
        u = self.creer(ville="Douala", quartier="Akwa", rue_ou_repere="Rue Joss")
        self.assertEqual(u.adresse_formatee, "Rue Joss, Akwa, Douala")
        u.quartier = ""
        self.assertEqual(u.adresse_formatee, "Rue Joss, Douala")
        self.assertEqual(self.creer(email="b@exemple.cm").adresse_formatee, "")

    def test_str(self):
        self.assertEqual(str(self.creer()), "Awa Test <awa@exemple.cm>")

    def test_ordre_par_inscription_decroissante(self):
        a = self.creer(email="a@exemple.cm")
        b = self.creer(email="b@exemple.cm")
        self.assertEqual(list(Utilisateur.objects.all()), [b, a])


class RolesTests(TestCase):
    def test_roles(self):
        self.assertEqual(set(Role.values), {"client", "membre", "super_admin"})
        self.assertEqual(set(ROLES_EQUIPE), {Role.MEMBRE, Role.SUPER_ADMIN})
        self.assertTrue(est_role_equipe("membre"))
        self.assertTrue(est_role_equipe("super_admin"))
        self.assertFalse(est_role_equipe("client"))
        self.assertFalse(est_role_equipe(None))
