"""API des commandes : client (/api/commandes/) et équipe (/api/admin/commandes/)."""
from pathlib import Path

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.commandes.models import Commande
from apps.commandes.tests.outils import BaseVague2, creer_client_sans_adresse, creer_commande
from apps.selection import services as selection

URL = "/api/commandes/"
URL_ADMIN = "/api/admin/commandes/"


class CommandesClientTests(BaseVague2):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.client_a)

    def creer(self, **plus):
        donnees = {"type_batiment": "maison", "surface_m2": "42.50", "description": "Salon",
                   "lignes": [{"produit": self.produit.pk, "design": self.design.pk}], **plus}
        return self.client.post(URL, donnees, format="json")

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.client.force_authenticate(self.membre)
        r = self.client.post(URL, {"type_batiment": "maison"}, format="json")
        self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))

    def test_creation_et_detail(self):
        r = self.creer()
        self.assertEqual(r.status_code, 201, r.content)
        d = r.data
        self.assertRegex(d["reference"], r"^CIR-\d{4}-0001$")
        self.assertEqual((d["etat"], d["surface_m2"], d["description"]), ("nouvelle", "42.50", "Salon"))
        self.assertEqual(d["adresse"], {"ville": "Douala", "quartier": "Bonapriso",
                                        "rue_ou_repere": "Près de la pharmacie"})
        self.assertEqual(d["lignes"][0]["produit"]["reference"], "YD-500")
        self.assertEqual(d["lignes"][0]["design"], {"id": self.design.pk, "nom": "Gris", "couleur": "#808080"})
        self.assertIsNone(d["montant_convenu"])
        self.assertEqual((d["propositions"], d["historique"], d["devis"], d["contrat"]), ([], [], [], None))
        self.assertEqual(d["actions_possibles"], ["modifier", "annuler", "proposer"])
        self.assertFalse(d["action_requise"])
        self.assertNotIn("notes_internes", d)
        self.assertNotIn("client", d)

    def test_adresse_incomplete(self):
        self.se_connecter(creer_client_sans_adresse())
        r = self.creer()
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "adresse_incomplete")
        self.assertIn("detail", r.data)
        self.assertEqual(Commande.objects.count(), 0)

    def test_validations(self):
        cas = [({"type_batiment": "piscine"}, "type_batiment"), ({"type_batiment": None}, "type_batiment"),
               ({"lignes": []}, "lignes"), ({"lignes": [{"produit": self.hors_ligne.pk}]}, "lignes"),
               ({"surface_m2": "0"}, "surface_m2"), ({"surface_m2": "abc"}, "surface_m2")]
        for plus, champ in cas:
            with self.subTest(plus=plus):
                r = self.creer(**plus)
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn(champ, r.data)

    def test_creation_depuis_la_selection(self):
        selection.ajouter(self.client_a, self.produit.pk, self.design.pk)
        r = self.client.post(URL, {"type_batiment": "entreprise", "depuis_selection": True}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(len(r.data["lignes"]), 1)
        self.assertEqual(self.client.get("/api/selection/").data["count"], 0)

    def test_quota_429(self):
        for _i in range(5):
            self.assertEqual(self.creer().status_code, 201)
        self.assertEqual(self.creer().status_code, 429)

    def test_liste_filtre_et_isolation(self):
        a1 = creer_commande(self.client_a, self.produit)
        a2 = creer_commande(self.client_a, self.produit, type_batiment="industrie")
        b1 = creer_commande(self.client_b, self.produit)
        r = self.client.get(URL)
        self.assertEqual(r.data["count"], 2)
        self.assertEqual([c["id"] for c in r.data["results"]], [a2.pk, a1.pk])  # plus récent d'abord
        self.assertEqual(set(r.data["results"][0]), {"id", "reference", "type_batiment", "etat", "surface_m2",
                                                     "nombre_lignes", "montant_convenu", "action_requise",
                                                     "modifie_le", "cree_le"})
        self.client.post(f"{URL}{a1.pk}/annuler/", {}, format="json")
        self.assertEqual([c["id"] for c in self.client.get(f"{URL}?etat=annulee").data["results"]], [a1.pk])
        self.assertEqual(self.client.get(f"{URL}?etat=inconnu").data["count"], 2)
        # l'objet d'un autre client : 404, jamais 403, pour toutes les routes
        for methode, chemin, corps in [("get", f"{URL}{b1.pk}/", None), ("patch", f"{URL}{b1.pk}/", {}),
                                       ("post", f"{URL}{b1.pk}/annuler/", {}),
                                       ("post", f"{URL}{b1.pk}/propositions/", {"total": 1})]:
            with self.subTest(chemin=chemin):
                r = getattr(self.client, methode)(chemin, corps, format="json") if corps is not None \
                    else getattr(self.client, methode)(chemin)
                self.assertEqual(r.status_code, 404)

    def test_modification_seulement_en_nouvelle(self):
        c = creer_commande(self.client_a, self.produit)
        r = self.client.patch(f"{URL}{c.pk}/", {"surface_m2": "30", "description": "Garage"}, format="json")
        self.assertEqual((r.status_code, r.data["surface_m2"], r.data["description"]), (200, "30.00", "Garage"))
        self.client.post(f"{URL}{c.pk}/propositions/", {"total": 100000}, format="json")
        r = self.client.patch(f"{URL}{c.pk}/", {"surface_m2": "31"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.put(f"{URL}{c.pk}/", {}, format="json").status_code, 405)

    def test_annulation_avec_motif(self):
        c = creer_commande(self.client_a, self.produit)
        r = self.client.post(f"{URL}{c.pk}/annuler/", {"motif": "Plus besoin"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["etat"], "annulee")
        self.assertEqual(r.data["actions_possibles"], [])
        self.assertEqual((r.data["historique"][0]["par"], r.data["historique"][0]["motif"]), ("client", "Plus besoin"))
        self.assertEqual(self.client.post(f"{URL}{c.pk}/annuler/", {}, format="json").status_code, 400)

    def test_client_ne_peut_pas_annuler_un_contrat_signe(self):
        c = creer_commande(self.client_a, self.produit, surface_m2="10")
        self.client.post(f"{URL}{c.pk}/propositions/", {"total": 5000}, format="json")
        self.se_connecter(self.membre)
        pid = c.propositions.get().pk
        self.client.post(f"{URL_ADMIN}{c.pk}/propositions/{pid}/accepter/", {}, format="json")
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{c.pk}/annuler/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.get(f"{URL}{c.pk}/").data["actions_possibles"], [])


class NegociationBoutEnBoutTests(BaseVague2):
    """Parcours complet : commande, contre-propositions, contrat, travaux, fin."""

    def test_parcours(self):
        self.se_connecter(self.client_a)
        c = self.client.post(URL, {"type_batiment": "maison", "surface_m2": "40",
                                   "lignes": [{"produit": self.produit.pk}]}, format="json").data
        cid = c["id"]
        # l'équipe voit une commande « nouvelle » qui demande une action
        self.se_connecter(self.membre)
        r = self.client.get(f"{URL_ADMIN}?action_requise=1")
        self.assertEqual([x["id"] for x in r.data["results"]], [cid])
        # proposition du client
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{cid}/propositions/", {"prix_m2": "9000", "delai_jours": 20, "message": "Merci"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["total"], r.data["prix_m2"], r.data["auteur_role"], r.data["etat"]),
                         ("360000", "9000", "client", "en_attente"))
        self.assertFalse(r.data["peut_repondre"])  # c'est sa propre proposition
        detail = self.client.get(f"{URL}{cid}/").data
        self.assertEqual(detail["etat"], "negociation")
        self.assertFalse(detail["action_requise"])
        self.assertEqual(detail["actions_possibles"], ["annuler", "proposer"])
        # côté équipe : elle peut répondre
        self.se_connecter(self.membre)
        detail = self.client.get(f"{URL_ADMIN}{cid}/").data
        self.assertTrue(detail["propositions"][0]["peut_repondre"])
        self.assertTrue(detail["action_requise"])
        self.assertEqual(self.client.get(f"{URL_ADMIN}?action_requise=1").data["count"], 1)
        # contre-proposition de l'équipe
        r = self.client.post(f"{URL_ADMIN}{cid}/propositions/", {"prix_m2": 12000, "delai_jours": 15}, format="json")
        self.assertEqual((r.status_code, r.data["auteur_role"], r.data["total"]), (201, "equipe", "480000"))
        pid = r.data["id"]
        self.assertEqual(self.client.get(f"{URL_ADMIN}?action_requise=1").data["count"], 0)
        # le client a une action requise et peut accepter
        self.se_connecter(self.client_a)
        self.assertTrue(self.client.get(URL).data["results"][0]["action_requise"])
        detail = self.client.get(f"{URL}{cid}/").data
        self.assertEqual([(p["auteur_role"], p["etat"], p["peut_repondre"]) for p in detail["propositions"]],
                         [("client", "remplacee", False), ("equipe", "en_attente", True)])
        r = self.client.post(f"{URL}{cid}/propositions/{pid}/accepter/", {"message": "D'accord"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.data["etat"], r.data["montant_convenu"], r.data["prix_m2_convenu"],
                          r.data["delai_convenu_jours"]), ("contrat_signe", "480000", "12000", 15))
        self.assertIsNotNone(r.data["signe_le"])
        contrat = r.data["contrat"]
        self.assertEqual((contrat["accepte_par"], contrat["montant"], contrat["prix_m2"], contrat["delai_jours"],
                          contrat["proposition"]), ("client", "480000", "12000", 15, pid))
        self.assertEqual(contrat["client"]["email"], "a@exemple.cm")
        self.assertEqual(contrat["reference"], r.data["reference"])
        self.assertEqual(contrat["lignes"], [{"produit_nom": "Sol autolissant", "produit_reference": "YD-500",
                                              "design_nom": None}])
        self.assertEqual([h["vers"] for h in r.data["historique"]], ["negociation", "contrat_signe"])
        self.assertEqual(r.data["actions_possibles"], [])
        self.assertFalse(r.data["propositions"][1]["peut_repondre"])
        # l'équipe démarre puis termine
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(f"{URL_ADMIN}{cid}/").data["actions_possibles"],
                         ["annuler", "demarrer_travaux"])
        r = self.client.post(f"{URL_ADMIN}{cid}/etat/", {"etat": "travaux"}, format="json")
        self.assertEqual((r.status_code, r.data["etat"], r.data["actions_possibles"]), (200, "travaux", ["terminer"]))
        r = self.client.post(f"{URL_ADMIN}{cid}/etat/", {"etat": "terminee"}, format="json")
        self.assertEqual((r.status_code, r.data["etat"], r.data["actions_possibles"]), (200, "terminee", []))
        self.assertEqual([h["par"] for h in r.data["historique"]], ["client", "client", "equipe", "equipe"])
        resume = self.client.get(f"{URL_ADMIN}resume/").data
        self.assertEqual(resume, {"nouvelle": 0, "negociation": 0, "contrat_signe": 0, "travaux": 0, "terminee": 1,
                                  "annulee": 0, "total": 1, "action_requise": 0})

    def test_refus_puis_reproposition(self):
        c = creer_commande(self.client_a, self.produit, surface_m2="10")
        self.se_connecter(self.membre)
        p = self.client.post(f"{URL_ADMIN}{c.pk}/propositions/", {"total": 200000}, format="json").data
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{c.pk}/propositions/{p['id']}/refuser/", {"message": "Trop cher"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["etat"], "negociation")
        self.assertEqual((r.data["propositions"][0]["etat"], r.data["propositions"][0]["reponse"]),
                         ("refusee", "Trop cher"))
        for chemin in ("accepter", "refuser"):  # plus en attente : 400
            self.assertEqual(self.client.post(f"{URL}{c.pk}/propositions/{p['id']}/{chemin}/", {}, format="json")
                             .status_code, 400)
        self.assertEqual(self.client.post(f"{URL}{c.pk}/propositions/", {"total": 150000}, format="json")
                         .status_code, 201)

    def test_reponse_a_sa_propre_proposition_et_proposition_inconnue(self):
        c = creer_commande(self.client_a, self.produit)
        self.se_connecter(self.client_a)
        p = self.client.post(f"{URL}{c.pk}/propositions/", {"total": 100}, format="json").data
        self.assertEqual(self.client.post(f"{URL}{c.pk}/propositions/{p['id']}/accepter/", {}, format="json")
                         .status_code, 400)
        self.assertEqual(self.client.post(f"{URL}{c.pk}/propositions/99999/accepter/", {}, format="json")
                         .status_code, 404)

    def test_validation_des_propositions(self):
        c = creer_commande(self.client_a, self.produit, surface_m2="10")
        self.se_connecter(self.client_a)
        cas = [({}, "detail"), ({"delai_jours": 5}, "detail"), ({"prix_m2": -5}, "prix_m2"),
               ({"total": "abc"}, "total"), ({"total": 1.5}, "total"), ({"total": 10, "delai_jours": 0}, "delai_jours"),
               ({"total": 10, "message": "x" * 1001}, "message"), ({"prix_m2": 1000, "total": 5000}, "total")]
        for donnees, champ in cas:
            with self.subTest(donnees=donnees):
                r = self.client.post(f"{URL}{c.pk}/propositions/", donnees, format="json")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn(champ, r.data)
        # montants en chaîne acceptés
        r = self.client.post(f"{URL}{c.pk}/propositions/", {"prix_m2": "1000", "total": "10000"}, format="json")
        self.assertEqual(r.status_code, 201)


class CommandesEquipeTests(BaseVague2):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.membre)
        self.c1 = creer_commande(self.client_a, self.produit, surface_m2="20")
        self.c2 = creer_commande(self.client_b, self.autre_produit, type_batiment="industrie")

    def test_acces_reserve_a_l_equipe(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 401)
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 403)
        self.assertEqual(self.client.get(f"{URL_ADMIN}resume/").status_code, 403)

    def test_liste_et_filtres(self):
        r = self.client.get(URL_ADMIN)
        self.assertEqual(r.data["count"], 2)
        premier = r.data["results"][0]
        self.assertEqual(set(premier), {"id", "reference", "type_batiment", "etat", "surface_m2", "nombre_lignes",
                                        "montant_convenu", "client", "action_requise", "modifie_le", "cree_le"})
        self.assertEqual(premier["client"], {"id": self.client_b.pk, "nom_complet": "Bruno Client",
                                             "email": "b@exemple.cm", "telephone": "", "ville": "Douala"})
        cas = {"type=industrie": [self.c2.pk], f"client={self.client_a.pk}": [self.c1.pk],
               f"search={self.c1.reference}": [self.c1.pk], "search=bruno": [self.c2.pk],
               "search=b@exemple": [self.c2.pk], "etat=nouvelle&type=maison": [self.c1.pk], "etat=terminee": []}
        for requete, attendus in cas.items():
            with self.subTest(requete=requete):
                self.assertEqual([c["id"] for c in self.client.get(f"{URL_ADMIN}?{requete}").data["results"]],
                                 attendus)

    def test_detail_equipe_et_notes_internes(self):
        r = self.client.patch(f"{URL_ADMIN}{self.c1.pk}/", {"notes_internes": "Client exigeant", "surface_m2": "25"},
                              format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.data["notes_internes"], r.data["surface_m2"]), ("Client exigeant", "25.00"))
        self.assertEqual(r.data["client"], {"id": self.client_a.pk, "nom_complet": "Alice Client",
                                            "email": "a@exemple.cm", "telephone": "", "ville": "Douala",
                                            "quartier": "Bonapriso", "rue_ou_repere": "Près de la pharmacie",
                                            "langue": "fr"})
        self.assertEqual(r.data["actions_possibles"], ["modifier", "annuler", "proposer"])
        # jamais côté client
        self.se_connecter(self.client_a)
        detail = self.client.get(f"{URL}{self.c1.pk}/")
        self.assertNotIn("notes_internes", detail.data)
        self.assertNotIn("Client exigeant", detail.content.decode())
        self.assertNotIn("Client exigeant", self.client.get(URL).content.decode())

    def test_etat_equipe(self):
        base = f"{URL_ADMIN}{self.c1.pk}/etat/"
        for etat in ("negociation", "contrat_signe", "terminee", "travaux", "nouvelle", "inconnu"):
            with self.subTest(etat=etat):
                self.assertEqual(self.client.post(base, {"etat": etat}, format="json").status_code, 400)
        r = self.client.post(base, {"etat": "annulee", "motif": "Doublon"}, format="json")
        self.assertEqual((r.status_code, r.data["etat"]), (200, "annulee"))
        self.assertEqual(r.data["historique"][0]["motif"], "Doublon")
        self.assertEqual(self.client.post(base, {"etat": "annulee"}, format="json").status_code, 400)

    def test_equipe_annule_un_contrat_signe(self):
        p = self.client.post(f"{URL_ADMIN}{self.c1.pk}/propositions/", {"total": 1000}, format="json").data
        self.se_connecter(self.client_a)
        self.client.post(f"{URL}{self.c1.pk}/propositions/{p['id']}/accepter/", {}, format="json")
        self.se_connecter(self.membre)
        r = self.client.post(f"{URL_ADMIN}{self.c1.pk}/etat/", {"etat": "annulee"}, format="json")
        self.assertEqual((r.status_code, r.data["etat"]), (200, "annulee"))
        self.assertEqual(self.client.patch(f"{URL_ADMIN}{self.c1.pk}/", {"surface_m2": "30"}, format="json")
                         .status_code, 400)
        r = self.client.patch(f"{URL_ADMIN}{self.c1.pk}/", {"notes_internes": "Après clôture"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_l_equipe_ne_peut_pas_repondre_a_sa_proposition(self):
        p = self.client.post(f"{URL_ADMIN}{self.c1.pk}/propositions/", {"total": 1000}, format="json").data
        r = self.client.post(f"{URL_ADMIN}{self.c1.pk}/propositions/{p['id']}/accepter/", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_langue(self):
        r = self.client.post(f"{URL_ADMIN}{self.c1.pk}/etat/", {"etat": "terminee"}, format="json",
                             HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.status_code, 400)
        self.assertIn("cannot move", r.data["detail"])
        r = self.client.post(f"{URL_ADMIN}{self.c1.pk}/etat/", {"etat": "terminee"}, format="json",
                             HTTP_ACCEPT_LANGUAGE="ja")
        self.assertIn("移せません", r.data["detail"])


class LanguesEtRequetesTests(BaseVague2):
    def test_noms_traduits_et_codes_d_erreur_traduits(self):
        self.se_connecter(self.client_a)
        c = creer_commande(self.client_a, self.produit)
        d = self.client.get(f"{URL}{c.pk}/", HTTP_ACCEPT_LANGUAGE="en").data
        self.assertEqual(d["lignes"][0]["produit"]["nom"], "Self-levelling floor")
        self.assertEqual(d["lignes"][0]["produit"]["reference"], "YD-500")
        d = self.client.get(f"{URL}{c.pk}/").data
        self.assertEqual(d["lignes"][0]["produit"]["nom"], "Sol autolissant")
        self.se_connecter(creer_client_sans_adresse())
        r = self.client.post(URL, {"type_batiment": "maison", "lignes": [{"produit": self.produit.pk}]},
                             format="json", HTTP_ACCEPT_LANGUAGE="de")
        self.assertEqual(r.data["code"], "adresse_incomplete")
        self.assertIn("Adresse", r.data["detail"])

    def test_produit_supprime_garde_l_instantane(self):
        self.se_connecter(self.client_a)
        c = creer_commande(self.client_a, self.autre_produit)
        self.autre_produit.delete()
        ligne = self.client.get(f"{URL}{c.pk}/").data["lignes"][0]
        self.assertEqual(ligne["produit"]["nom"], "Primaire")
        self.assertIsNone(ligne["produit"]["id"])

    def test_pas_de_requete_par_commande(self):
        self.se_connecter(self.client_a)
        for _i in range(4):
            creer_commande(self.client_a, self.produit)
        with CaptureQueriesContext(connection) as ctx:
            r = self.client.get(URL)
        self.assertEqual(r.data["count"], 4)
        self.assertLessEqual(len(ctx), 5)
        self.se_connecter(self.membre)
        with CaptureQueriesContext(connection) as ctx:
            r = self.client.get(URL_ADMIN)
        self.assertEqual(r.data["count"], 4)
        self.assertLessEqual(len(ctx), 5)

    def test_detail_sans_requete_par_ligne(self):
        self.se_connecter(self.client_a)
        c = creer_commande(self.client_a, self.produit)
        mesures = []
        for nombre in (1, 6):
            c.lignes.all().delete()
            for _i in range(nombre):
                c.lignes.create(produit=self.produit, design=self.design, produit_nom="x")
            with CaptureQueriesContext(connection) as ctx:
                self.assertEqual(self.client.get(f"{URL}{c.pk}/").status_code, 200)
            mesures.append(len(ctx))
        self.assertEqual(mesures[0], mesures[1])


class IndependanceTests(BaseVague2):
    def test_commandes_n_importe_jamais_devis(self):
        racine = Path(__file__).resolve().parent.parent
        for fichier in racine.glob("*.py"):
            for ligne in fichier.read_text(encoding="utf-8").splitlines():
                if ligne.lstrip().startswith(("import ", "from ")):
                    self.assertNotIn("apps.devis", ligne, f"{fichier.name} : {ligne}")
