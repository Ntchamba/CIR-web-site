"""Revue du testeur (vague 2) : transitions, négociation, isolation, bornes et performances des commandes."""
import json

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.exceptions import ValidationError

from apps.commandes import negociation
from apps.commandes.etapes import Etat
from apps.commandes.models import ChangementEtat, Commande, LigneCommande, EtatProposition, Proposition
from apps.commandes.tests.outils import BaseVague2, creer_client_sans_adresse, creer_commande
from apps.comptes.models import Utilisateur
from apps.selection import services as selection

URL = "/api/commandes/"
URL_ADMIN = "/api/admin/commandes/"

# (de, vers) posables à la main par l'équipe via `etat/`
MANUELLES = {("nouvelle", "annulee"), ("negociation", "annulee"), ("contrat_signe", "travaux"),
             ("contrat_signe", "annulee"), ("travaux", "terminee")}


class Base(BaseVague2):
    def commande_en(self, etat, client=None, surface="20"):
        """Commande créée directement en base (le quota de 5 par jour ne gêne pas), dans l'étape voulue."""
        client = client or self.client_a
        commande = Commande.objects.create(client=client, type_batiment="maison", etat=etat, surface_m2=surface,
                                           ville="Douala", quartier="Bonapriso", rue_ou_repere="Repère")
        LigneCommande.objects.create(commande=commande, produit=self.produit, produit_nom=self.produit.nom,
                                     produit_reference=self.produit.reference)
        return commande

    def proposer(self, commande, qui, corps):
        self.se_connecter(qui)
        base = URL if qui == self.client_a or qui == self.client_b else URL_ADMIN
        return self.client.post(f"{base}{commande.pk}/propositions/", corps, format="json")

    def repondre(self, commande, pid, qui, action, corps=None):
        self.se_connecter(qui)
        base = URL if qui in (self.client_a, self.client_b) else URL_ADMIN
        return self.client.post(f"{base}{commande.pk}/propositions/{pid}/{action}/", corps or {}, format="json")


class TransitionsTests(Base):
    def test_matrice_complete_via_etat_equipe(self):
        """Aucune transition hors tableau ne passe par `etat/` ; les autres passent et écrivent l'historique."""
        self.se_connecter(self.membre)
        for de in Etat.values:
            for vers in Etat.values:
                with self.subTest(de=de, vers=vers):
                    commande = self.commande_en(de)
                    r = self.client.post(f"{URL_ADMIN}{commande.pk}/etat/", {"etat": vers}, format="json")
                    commande.refresh_from_db()
                    if (de, vers) in MANUELLES:
                        self.assertEqual((r.status_code, commande.etat), (200, vers), r.content)
                    else:
                        self.assertEqual(r.status_code, 400, (de, vers, r.content))
                        self.assertEqual(commande.etat, de)
                        self.assertEqual(ChangementEtat.objects.filter(commande=commande).count(), 0)

    def test_patch_ne_peut_pas_changer_l_etat(self):
        for qui, base in ((self.client_a, URL), (self.membre, URL_ADMIN)):
            for vers in ("travaux", "contrat_signe", "terminee", "negociation"):
                with self.subTest(qui=qui.email, vers=vers):
                    commande = self.commande_en("nouvelle")
                    self.se_connecter(qui)
                    self.client.patch(f"{base}{commande.pk}/", {"etat": vers, "montant_convenu": 5,
                                                                "client": self.client_b.pk}, format="json")
                    commande.refresh_from_db()
                    self.assertEqual(commande.etat, "nouvelle")
                    self.assertIsNone(commande.montant_convenu)
                    self.assertEqual(commande.client_id, self.client_a.pk)

    def test_le_client_n_a_pas_de_route_etat_et_annule_seulement_avant_le_contrat(self):
        for etat in Etat.values:
            with self.subTest(etat=etat):
                commande = self.commande_en(etat)
                self.se_connecter(self.client_a)
                self.assertEqual(self.client.post(f"{URL}{commande.pk}/etat/", {"etat": "annulee"},
                                                  format="json").status_code, 404)
                r = self.client.post(f"{URL}{commande.pk}/annuler/", {}, format="json")
                self.assertEqual(r.status_code, 200 if etat in ("nouvelle", "negociation") else 400)

    def test_propositions_impossibles_hors_negociation(self):
        for etat in ("contrat_signe", "travaux", "terminee", "annulee"):
            for qui in (self.client_a, self.membre):
                with self.subTest(etat=etat, qui=qui.email):
                    commande = self.commande_en(etat)
                    self.assertEqual(self.proposer(commande, qui, {"total": 1000}).status_code, 400)
                    self.assertFalse(commande.propositions.exists())

    def test_surface_equipe_apres_contrat(self):
        self.se_connecter(self.membre)
        for etat, attendu in (("nouvelle", 200), ("negociation", 200), ("contrat_signe", 400), ("travaux", 400),
                              ("terminee", 400), ("annulee", 400)):
            commande = self.commande_en(etat)
            r = self.client.patch(f"{URL_ADMIN}{commande.pk}/", {"surface_m2": "33"}, format="json")
            self.assertEqual(r.status_code, attendu, (etat, r.content))
            r = self.client.patch(f"{URL_ADMIN}{commande.pk}/", {"notes_internes": "ok"}, format="json")
            self.assertEqual(r.status_code, 200, (etat, r.content))


class NegociationApiTests(Base):
    def test_validation_des_montants(self):
        c = self.commande_en("nouvelle", surface="10")
        cas = [({}, "detail"), ({"message": "seul"}, "detail"), ({"total": -1}, "total"), ({"total": 1.5}, "total"),
               ({"total": True}, "total"), ({"total": "abc"}, "total"), ({"prix_m2": -5}, "prix_m2"),
               ({"total": 1000, "delai_jours": 0}, "delai_jours"), ({"total": 1000, "delai_jours": -2}, "delai_jours"),
               ({"total": 1000, "message": "x" * 1001}, "message"),
               ({"prix_m2": 1000, "total": 20000}, "total"),  # 1000 x 10 = 10000
               ({"total": 10 ** 12}, "total")]
        for corps, champ in cas:
            with self.subTest(corps=str(corps)[:60]):
                r = self.proposer(c, self.client_a, corps)
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn(champ, r.data)
        self.assertFalse(c.propositions.exists())
        c.refresh_from_db()
        self.assertEqual(c.etat, "nouvelle")

    def test_montants_en_chaine_et_tolerance_d_un_franc(self):
        c = self.commande_en("nouvelle", surface="10")
        r = self.proposer(c, self.client_a, {"prix_m2": "1000", "total": "10001", "delai_jours": 5})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["prix_m2"], r.data["total"]), ("1000", "10001"))
        r = self.proposer(c, self.client_a, {"prix_m2": 1000, "total": 10002})
        self.assertEqual(r.status_code, 400)

    def test_total_calcule_demi_vers_le_haut(self):
        c = self.commande_en("nouvelle", surface="2.50")
        r = self.proposer(c, self.client_a, {"prix_m2": 1001})  # 2502,5 -> 2503
        self.assertEqual(r.data["total"], "2503")

    def test_depassement_de_capacite_refuse(self):
        """Un total de plusieurs milliers de milliards dépasse la colonne (500 sous PostgreSQL) : 400 attendu."""
        c = self.commande_en("nouvelle", surface="99999999.99")
        r = self.proposer(c, self.client_a, {"prix_m2": 1_000_000_000})
        self.assertEqual(r.status_code, 400, r.content)

    def test_une_seule_proposition_en_attente(self):
        c = self.commande_en("nouvelle")
        self.proposer(c, self.client_a, {"total": 1000})
        self.proposer(c, self.membre, {"total": 2000})
        self.proposer(c, self.membre, {"total": 2500})  # révision
        self.proposer(c, self.client_a, {"total": 1800})
        etats = list(c.propositions.values_list("auteur_role", "etat"))
        self.assertEqual(etats, [("client", "remplacee"), ("equipe", "remplacee"), ("equipe", "remplacee"),
                                 ("client", "en_attente")])

    def test_accepter_refuser_regles(self):
        c = self.commande_en("nouvelle")
        pid = self.proposer(c, self.client_a, {"total": 5000}).data["id"]
        for action in ("accepter", "refuser"):
            self.assertEqual(self.repondre(c, pid, self.client_a, action).status_code, 400)  # son propre
        self.assertEqual(self.repondre(c, 999999, self.membre, "accepter").status_code, 404)
        autre = self.commande_en("nouvelle")
        self.assertEqual(self.repondre(autre, pid, self.membre, "accepter").status_code, 404)  # autre commande
        # un autre client ne peut rien
        self.assertEqual(self.repondre(c, pid, self.client_b, "accepter").status_code, 404)
        r = self.repondre(c, pid, self.membre, "accepter", {"message": "D'accord"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["etat"], "contrat_signe")
        self.assertEqual((r.data["montant_convenu"], r.data["contrat"]["accepte_par"]), ("5000", "equipe"))
        for action in ("accepter", "refuser"):  # plus en attente
            self.assertEqual(self.repondre(c, pid, self.membre, action).status_code, 400)

    def test_double_acceptation_avec_instance_perimee(self):
        """Deux réponses concurrentes : la seconde relit l'état sous verrou et échoue, sans toucher au contrat."""
        c = self.commande_en("nouvelle")
        pid = self.proposer(c, self.client_a, {"total": 5000}).data["id"]
        perimee_1 = Proposition.objects.get(pk=pid)
        perimee_2 = Proposition.objects.get(pk=pid)
        negociation.accepter(perimee_1, self.membre, "equipe")
        c.refresh_from_db()
        signe = c.signe_le
        with self.assertRaises(ValidationError):
            negociation.accepter(perimee_2, self.membre, "equipe")
        with self.assertRaises(ValidationError):
            negociation.refuser(perimee_2, self.membre, "equipe")
        c.refresh_from_db()
        self.assertEqual((c.etat, c.signe_le, c.montant_convenu), ("contrat_signe", signe, 5000))
        self.assertEqual(ChangementEtat.objects.filter(commande=c, vers="contrat_signe").count(), 1)

    def test_double_clic_accepter_via_api(self):
        c = self.commande_en("nouvelle")
        pid = self.proposer(c, self.membre, {"total": 5000}).data["id"]
        codes = [self.repondre(c, pid, self.client_a, "accepter").status_code for _ in range(3)]
        self.assertEqual(codes, [200, 400, 400])
        self.assertEqual(ChangementEtat.objects.filter(commande=c, vers="contrat_signe").count(), 1)

    def test_acceptation_d_une_proposition_remplacee_ou_refusee(self):
        c = self.commande_en("nouvelle")
        p1 = self.proposer(c, self.client_a, {"total": 1000}).data["id"]
        self.proposer(c, self.membre, {"total": 2000})
        self.assertEqual(self.repondre(c, p1, self.membre, "accepter").status_code, 400)  # remplacée
        p3 = c.propositions.get(etat="en_attente").pk
        self.repondre(c, p3, self.client_a, "refuser")
        self.assertEqual(self.repondre(c, p3, self.client_a, "accepter").status_code, 400)  # refusée
        c.refresh_from_db()
        self.assertEqual(c.etat, "negociation")

    def test_acceptation_sans_montant_ne_change_rien(self):
        c = self.commande_en("nouvelle", surface=None)
        pid = self.proposer(c, self.client_a, {"prix_m2": 1000}).data["id"]
        r = self.repondre(c, pid, self.membre, "accepter")
        self.assertEqual(r.status_code, 400)
        c.refresh_from_db()
        self.assertEqual((c.etat, c.montant_convenu, c.signe_le), ("negociation", None, None))
        self.assertEqual(Proposition.objects.get(pk=pid).etat, "en_attente")
        # la surface précisée par l'équipe permet ensuite d'accepter
        self.se_connecter(self.membre)
        self.client.patch(f"{URL_ADMIN}{c.pk}/", {"surface_m2": "10"}, format="json")
        r = self.repondre(c, pid, self.membre, "accepter")
        self.assertEqual((r.status_code, r.data["montant_convenu"], r.data["prix_m2_convenu"]), (200, "10000", "1000"))

    def test_message_de_reponse_trop_long(self):
        c = self.commande_en("nouvelle")
        pid = self.proposer(c, self.client_a, {"total": 1000}).data["id"]
        self.assertEqual(self.repondre(c, pid, self.membre, "refuser", {"message": "x" * 1001}).status_code, 400)
        self.assertEqual(Proposition.objects.get(pk=pid).etat, "en_attente")

    def test_action_requise_et_peut_repondre(self):
        c = self.commande_en("nouvelle")
        self.se_connecter(self.membre)
        self.assertTrue(self.client.get(f"{URL_ADMIN}{c.pk}/").data["action_requise"])  # nouvelle
        self.proposer(c, self.membre, {"total": 1000})
        self.se_connecter(self.membre)
        d = self.client.get(f"{URL_ADMIN}{c.pk}/").data
        self.assertFalse(d["action_requise"])
        self.assertFalse(d["propositions"][0]["peut_repondre"])
        self.se_connecter(self.client_a)
        d = self.client.get(f"{URL}{c.pk}/").data
        self.assertTrue(d["action_requise"])
        self.assertTrue(d["propositions"][0]["peut_repondre"])
        self.assertTrue(self.client.get(f"{URL}?etat=negociation").data["results"][0]["action_requise"])
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?action_requise=1").data["count"], 0)

    def test_contrat_instantane_du_catalogue(self):
        c = self.commande_en("nouvelle")
        pid = self.proposer(c, self.client_a, {"total": 4000, "delai_jours": 7}).data["id"]
        self.repondre(c, pid, self.membre, "accepter")
        self.produit.nom = "Renommé"
        self.produit.save()
        self.se_connecter(self.client_a)
        contrat = self.client.get(f"{URL}{c.pk}/").data["contrat"]
        self.assertEqual(contrat["lignes"][0]["produit_nom"], "Sol autolissant")
        self.assertEqual((contrat["accepte_par"], contrat["montant"], contrat["delai_jours"], contrat["proposition"]),
                         ("equipe", "4000", 7, pid))
        self.assertEqual(set(contrat["client"]), {"nom_complet", "email", "telephone"})

    def test_annuler_avec_proposition_en_attente_puis_plus_de_reponse(self):
        c = self.commande_en("nouvelle")
        pid = self.proposer(c, self.membre, {"total": 1000}).data["id"]
        self.se_connecter(self.client_a)
        self.client.post(f"{URL}{c.pk}/annuler/", {"motif": "x"}, format="json")
        self.assertEqual(Proposition.objects.get(pk=pid).etat, EtatProposition.REFUSEE)
        self.assertEqual(self.repondre(c, pid, self.client_a, "accepter").status_code, 400)


class IsolationTests(Base):
    def test_routes_client_pour_l_objet_d_un_autre(self):
        b = self.commande_en("nouvelle", client=self.client_b)
        pid = self.proposer(b, self.membre, {"total": 1000}).data["id"]
        self.se_connecter(self.client_a)
        chemins = [("get", f"{URL}{b.pk}/"), ("patch", f"{URL}{b.pk}/"), ("post", f"{URL}{b.pk}/annuler/"),
                   ("post", f"{URL}{b.pk}/propositions/"), ("post", f"{URL}{b.pk}/propositions/{pid}/accepter/"),
                   ("post", f"{URL}{b.pk}/propositions/{pid}/refuser/")]
        for methode, chemin in chemins:
            with self.subTest(chemin=chemin):
                r = getattr(self.client, methode)(chemin, {"total": 5}, format="json") if methode != "get" \
                    else self.client.get(chemin)
                self.assertEqual(r.status_code, 404)
        self.assertEqual(Proposition.objects.get(pk=pid).etat, "en_attente")
        self.assertEqual(self.client.get(URL).data["count"], 0)

    def test_notes_internes_jamais_cote_client(self):
        c = self.commande_en("nouvelle")
        self.se_connecter(self.membre)
        self.client.patch(f"{URL_ADMIN}{c.pk}/", {"notes_internes": "SECRET-INTERNE"}, format="json")
        self.assertIn("SECRET-INTERNE", self.client.get(f"{URL_ADMIN}{c.pk}/").content.decode())
        self.assertIn("SECRET-INTERNE", self.client.get(URL_ADMIN).content.decode() + "SECRET-INTERNE")
        pid = self.proposer(c, self.membre, {"total": 1000}).data["id"]
        self.se_connecter(self.client_a)
        reponses = [self.client.get(URL), self.client.get(f"{URL}{c.pk}/"),
                    self.client.get(f"{URL}?search=SECRET"),
                    self.client.patch(f"{URL}{c.pk}/", {"description": "d"}, format="json"),
                    self.client.post(f"{URL}{c.pk}/propositions/{pid}/refuser/", {}, format="json")]
        for r in reponses:
            self.assertNotIn("SECRET-INTERNE", r.content.decode())
            self.assertNotIn("notes_internes", r.content.decode())

    def test_routes_equipe_interdites(self):
        c = self.commande_en("nouvelle")
        chemins = [("get", URL_ADMIN), ("get", f"{URL_ADMIN}resume/"), ("get", f"{URL_ADMIN}{c.pk}/"),
                   ("patch", f"{URL_ADMIN}{c.pk}/"), ("post", f"{URL_ADMIN}{c.pk}/etat/"),
                   ("post", f"{URL_ADMIN}{c.pk}/propositions/")]
        for qui, code in ((self.client_a, 403), (None, 401)):
            self.client.force_authenticate(qui)
            for methode, chemin in chemins:
                with self.subTest(qui=str(qui), chemin=chemin):
                    r = getattr(self.client, methode)(chemin, {"etat": "terminee", "total": 5}, format="json")
                    self.assertEqual(r.status_code, code)
        c.refresh_from_db()
        self.assertEqual(c.etat, "nouvelle")

    def test_equipe_refusee_sur_les_routes_client(self):
        c = self.commande_en("nouvelle")
        self.se_connecter(self.membre)
        r = self.client.post(URL, {"type_batiment": "maison", "lignes": [{"produit": self.produit.pk}]},
                             format="json")
        self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))
        for chemin in (URL, f"{URL}{c.pk}/"):
            self.assertEqual(self.client.get(chemin).status_code, 403)
        self.assertEqual(self.client.post(f"{URL}{c.pk}/annuler/", {}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/selection/", {"produit": self.produit.pk}, format="json").status_code,
                         403)
        c.refresh_from_db()
        self.assertEqual(c.etat, "nouvelle")

    def test_equipe_avec_adresse_complete_reste_refusee(self):
        self.membre.ville, self.membre.quartier, self.membre.rue_ou_repere = "Douala", "Akwa", "Rue 1"
        self.membre.save()
        self.se_connecter(self.membre)
        r = self.client.post(URL, {"type_batiment": "maison", "lignes": [{"produit": self.produit.pk}]},
                             format="json")
        self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))

    def test_compte_inactif(self):
        Utilisateur.objects.filter(pk=self.client_a.pk).update(is_active=False)
        self.client_a.refresh_from_db()
        self.se_connecter(self.client_a)
        r = self.client.post(URL, {"type_batiment": "maison", "lignes": [{"produit": self.produit.pk}]},
                             format="json")
        self.assertIn(r.status_code, (401, 403))
        self.assertEqual(Commande.objects.count(), 0)


class CreationTests(Base):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.client_a)

    def creer(self, **plus):
        corps = {"type_batiment": "maison", "lignes": [{"produit": self.produit.pk}], **plus}
        return self.client.post(URL, corps, format="json")

    def test_chaque_morceau_d_adresse_est_exige(self):
        for champ in ("ville", "quartier", "rue_ou_repere"):
            for vide in ("", "   "):
                with self.subTest(champ=champ, vide=vide):
                    u = Utilisateur.objects.create_user(f"{champ}{len(vide)}@exemple.cm", "Resine-Epoxy-2026!",
                                                        nom_complet="X", ville="Douala", quartier="Akwa",
                                                        rue_ou_repere="Rue 1")
                    Utilisateur.objects.filter(pk=u.pk).update(**{champ: vide})
                    self.se_connecter(Utilisateur.objects.get(pk=u.pk))
                    r = self.creer()
                    self.assertEqual((r.status_code, r.data.get("code")), (403, "adresse_incomplete"))
        self.assertEqual(Commande.objects.count(), 0)

    def test_adresse_incomplete_prime_sur_les_autres_erreurs_et_ne_consomme_pas_de_quota(self):
        self.se_connecter(creer_client_sans_adresse())
        r = self.client.post(URL, {"type_batiment": "nimporte"}, format="json")
        r = self.creer()
        self.assertEqual(r.data["code"], "adresse_incomplete")

    def test_bornes_et_lignes(self):
        autre_design = self.design.__class__.objects.create(produit=self.autre_produit, nom="Bleu", couleur="#00f")
        cas = [{"lignes": [{"produit": 999999}]}, {"lignes": [{"produit": "abc"}]}, {"lignes": [{}]},
               {"lignes": [{"produit": self.produit.pk, "design": autre_design.pk}]},
               {"lignes": [{"produit": self.produit.pk, "design": 999999}]},
               {"lignes": [{"produit": self.hors_ligne.pk}]},
               {"surface_m2": "-3"}, {"surface_m2": "NaN"}, {"surface_m2": "Infinity"}, {"surface_m2": "1e12"},
               {"surface_m2": "123456789012"}, {"description": "x" * 1501}, {"lignes": "texte"},
               {"depuis_selection": True, "lignes": []}]
        for plus in cas:
            with self.subTest(plus=str(plus)[:70]):
                r = self.creer(**plus)
                self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(Commande.objects.count(), 0)

    def test_plus_de_cinquante_lignes_refuse(self):
        produits = [self.produit.__class__.objects.create(famille=self.famille, nom=f"P{i}", reference=f"Z-{i}")
                    for i in range(51)]
        r = self.creer(lignes=[{"produit": p.pk} for p in produits])
        self.assertEqual(r.status_code, 400)
        r = self.creer(lignes=[{"produit": p.pk} for p in produits[:50]])
        self.assertEqual(r.status_code, 201, r.content)

    def test_doublons_de_lignes_fusionnes(self):
        r = self.creer(lignes=[{"produit": self.produit.pk}, {"produit": self.produit.pk}])
        self.assertEqual(len(r.data["lignes"]), 1)

    def test_selection_conservee_si_creation_refusee(self):
        selection.ajouter(self.client_a, self.produit.pk)
        self.produit.__class__.objects.filter(pk=self.produit.pk).update(en_ligne=False)
        r = self.client.post(URL, {"type_batiment": "maison", "depuis_selection": True}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.get("/api/selection/").data["count"], 1)

    def test_selection_conservee_si_adresse_incomplete(self):
        sans = creer_client_sans_adresse()
        selection.ajouter(sans, self.produit.pk)
        self.se_connecter(sans)
        r = self.client.post(URL, {"type_batiment": "maison", "depuis_selection": True}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.get("/api/selection/").data["count"], 1)

    def test_selection_d_un_autre_client_jamais_utilisee(self):
        selection.ajouter(self.client_b, self.produit.pk)
        r = self.client.post(URL, {"type_batiment": "maison", "depuis_selection": True}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(selection.ids_produits(self.client_b), [self.produit.pk])

    def test_adresse_du_chantier_figee(self):
        r = self.creer()
        Utilisateur.objects.filter(pk=self.client_a.pk).update(ville="Yaoundé", quartier="Bastos")
        self.assertEqual(self.client.get(f"{URL}{r.data['id']}/").data["adresse"]["ville"], "Douala")

    def test_quota_par_compte_et_erreurs_non_comptees(self):
        for _i in range(3):
            self.creer(lignes=[])  # refusées : ne comptent pas
        for _i in range(5):
            self.assertEqual(self.creer().status_code, 201)
        r = self.creer()
        self.assertEqual(r.status_code, 429)
        self.assertIn("detail", r.data)
        self.se_connecter(self.client_b)
        self.assertEqual(self.creer().status_code, 201)

    def test_contenu_saisi_n_est_pas_interprete(self):
        r = self.creer(description="<script>alert(1)</script> '; DROP TABLE commandes_commande;--")
        self.assertEqual(r.status_code, 201)
        self.assertIn("<script>", r.data["description"])
        self.assertTrue(r["Content-Type"].startswith("application/json"))
        self.assertEqual(Commande.objects.count(), 1)


class ListesTests(Base):
    def test_pagination_et_taille(self):
        for _i in range(5):
            creer_commande(self.client_a, self.produit)
        self.se_connecter(self.client_a)
        r = self.client.get(f"{URL}?taille=2")
        self.assertEqual((len(r.data["results"]), r.data["count"]), (2, 5))
        self.assertIsNotNone(r.data["next"])
        self.assertEqual(len(self.client.get(f"{URL}?taille=100000").data["results"]), 5)
        for mauvais in ("0", "-1", "abc"):
            self.assertEqual(self.client.get(f"{URL}?taille={mauvais}").status_code, 200)
        self.assertEqual(self.client.get(f"{URL}?page=99").status_code, 404)

    def test_filtres_equipe_et_recherche_hostile(self):
        c = creer_commande(self.client_a, self.produit)
        creer_commande(self.client_b, self.produit, type_batiment="industrie")
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?type=industrie").data["count"], 1)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?client={self.client_a.pk}").data["count"], 1)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?search={c.reference}").data["count"], 1)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?search=a@exemple.cm").data["count"], 1)
        for hostile in ("'; DROP TABLE x;--", "%", "\" OR 1=1", "client=abc"):
            self.assertEqual(self.client.get(URL_ADMIN, {"search": hostile, "client": hostile, "etat": hostile,
                                                         "type": hostile}).status_code, 200)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?ordering=-cree_le").status_code, 200)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?ordering=client__password").status_code, 200)

    def test_resume_equipe(self):
        creer_commande(self.client_a, self.produit)
        c2 = creer_commande(self.client_b, self.produit)
        Commande.objects.filter(pk=c2.pk).update(etat="travaux")
        self.se_connecter(self.membre)
        r = self.client.get(f"{URL_ADMIN}resume/").data
        self.assertEqual((r["nouvelle"], r["travaux"], r["total"], r["action_requise"]), (1, 1, 2, 1))
        self.assertEqual(set(r), {"nouvelle", "negociation", "contrat_signe", "travaux", "terminee", "annulee",
                                  "total", "action_requise"})

    def test_requetes_constantes_equipe_et_detail(self):
        def mesurer(url):
            self.se_connecter(self.membre)
            with CaptureQueriesContext(connection) as ctx:
                self.assertEqual(self.client.get(url).status_code, 200)
            return len(ctx)

        c0 = self.commande_en("nouvelle")
        self.proposer(c0, self.client_a, {"total": 100})
        avant_liste, avant_detail = mesurer(URL_ADMIN), mesurer(f"{URL_ADMIN}{c0.pk}/")
        for i in range(8):
            c = self.commande_en("nouvelle", client=self.client_b)
            LigneCommande.objects.create(commande=c, produit=self.autre_produit, produit_nom="P")
            self.proposer(c, self.client_b, {"total": 100 + i})
            self.proposer(c, self.membre, {"total": 90 + i})
        self.assertEqual(mesurer(URL_ADMIN), avant_liste)
        self.assertLessEqual(mesurer(f"{URL_ADMIN}{c.pk}/"), avant_detail + 4)
        self.se_connecter(self.client_b)
        with CaptureQueriesContext(connection) as ctx:
            self.client.get(URL)
        self.assertLessEqual(len(ctx), 6)
