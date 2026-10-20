"""Statistiques : exactitude sur des jeux de données construits, fuseau, période, rôles, requêtes, cache."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.catalogue.models import Famille, Produit
from apps.commandes.models import Commande, LigneCommande
from apps.commandes.tests.outils import creer_commande
from apps.noyau.tests.outils_direct import BaseVague3
from apps.paiements.models import EtatPaiement, ModePaiement, Paiement

URL = "/api/admin/statistiques/"
DOUALA = ZoneInfo("Africa/Douala")


def le(annee, mois, jour, heure=12, minute=0):
    return datetime(annee, mois, jour, heure, minute, tzinfo=DOUALA)


class BaseStats(BaseVague3):
    def setUp(self):
        super().setUp()
        cache.clear()
        famille = Famille.objects.create(nom="Finitions")
        self.p1 = Produit.objects.create(famille=famille, nom="Sol autolissant", reference="YD-500")
        self.p2 = Produit.objects.create(famille=famille, nom="Primaire", reference="YD-103")

    def commande(self, client=None, produit=None, cree=None, etat="nouvelle", signe=None, montant=None, paye=0,
                 type_batiment="maison"):
        c = creer_commande(client or self.client_a, produit or self.p1, type_batiment=type_batiment)
        Commande.objects.filter(pk=c.pk).update(cree_le=cree or timezone.now(), etat=etat, signe_le=signe,
                                                montant_convenu=montant, montant_paye=paye)
        return Commande.objects.get(pk=c.pk)

    def paiement(self, commande, montant, termine, etat=EtatPaiement.REUSSI):
        return Paiement.objects.create(commande=commande, client=commande.client, montant=montant,
                                       mode=ModePaiement.MANUEL, etat=etat, termine_le=termine)

    def resume(self, utilisateur, **params):
        self.se_connecter(utilisateur)
        return self.client.get(URL + "resume/", params)


class ResumeTests(BaseStats):
    def jeu(self):
        # Période : 1er au 31 octobre 2026
        self.commande(cree=le(2026, 10, 2), etat="nouvelle", type_batiment="maison")
        self.commande(cree=le(2026, 10, 5), etat="negociation", type_batiment="industrie")
        c3 = self.commande(cree=le(2026, 10, 10), etat="contrat_signe", signe=le(2026, 10, 12), montant=400_000,
                           paye=100_000, type_batiment="entreprise", produit=self.p2)
        c4 = self.commande(cree=le(2026, 10, 20), etat="terminee", signe=le(2026, 10, 24), montant=600_000, paye=600_000)
        self.commande(cree=le(2026, 10, 25), etat="annulee")
        self.commande(cree=le(2026, 9, 15), etat="travaux", signe=le(2026, 9, 20), montant=1_000_000, paye=0)  # avant
        self.paiement(c3, 100_000, le(2026, 10, 13))
        self.paiement(c4, 600_000, le(2026, 10, 30))
        self.paiement(c4, 5_000, le(2026, 10, 30), etat=EtatPaiement.ANOMALIE)  # jamais compté
        return c3, c4

    def test_exactitude_super_admin(self):
        self.jeu()
        r = self.resume(self.super_admin, du="2026-10-01", au="2026-10-31")
        self.assertEqual(r.status_code, 200, r.content)
        d = r.data
        self.assertEqual(d["periode"], {"du": "2026-10-01", "au": "2026-10-31"})
        c = d["commandes"]
        self.assertEqual(c["total"], 5)
        self.assertEqual(c["par_etape"], {"nouvelle": 1, "negociation": 1, "contrat_signe": 1, "travaux": 0,
                                          "terminee": 1, "annulee": 1})
        self.assertEqual(c["par_type_batiment"], {"maison": 3, "industrie": 1, "entreprise": 1})
        self.assertEqual((c["nouvelles"], c["signees"], c["taux_signature"]), (1, 2, 0.4))
        self.assertEqual(c["delai_moyen_signature_jours"], 3.0)  # (2 j + 4 j) / 2
        m = d["montants"]
        # reste à encaisser : 300 000 (c3) + 1 000 000 (commande de septembre en travaux)
        self.assertEqual(m, {"chiffre_convenu": 1_000_000, "encaisse": 700_000, "reste_a_encaisser": 1_300_000,
                             "nombre_paiements": 2, "panier_moyen": 500_000})
        self.assertEqual(d["top_produits"], [{"produit_nom": "Sol autolissant", "produit_reference": "YD-500",
                                              "commandes": 4}, {"produit_nom": "Primaire", "produit_reference": "YD-103",
                                                                "commandes": 1}])
        self.assertEqual(set(d["a_traiter"]), {"commandes_nouvelles", "propositions_en_attente_equipe",
                                               "devis_a_envoyer", "demandes_rendu", "demandes_contact",
                                               "messages_non_lus", "appels_manques", "paiements_anomalies"})
        self.assertEqual((d["a_traiter"]["commandes_nouvelles"], d["a_traiter"]["paiements_anomalies"]), (1, 1))

    def test_membre_simple_ne_voit_aucune_somme(self):
        self.jeu()
        d = self.resume(self.membre, du="2026-10-01", au="2026-10-31").data
        self.assertIsNone(d["montants"])
        self.assertNotIn("1000000", str(d["commandes"]))
        self.assertEqual(d["commandes"]["total"], 5)

    def test_cache_separe_par_role(self):
        self.jeu()
        self.assertIsNotNone(self.resume(self.super_admin, du="2026-10-01", au="2026-10-31").data["montants"])
        self.assertIsNone(self.resume(self.membre, du="2026-10-01", au="2026-10-31").data["montants"])

    def test_vide(self):
        d = self.resume(self.super_admin, du="2026-01-01", au="2026-01-31").data
        self.assertEqual(d["commandes"]["total"], 0)
        self.assertIsNone(d["commandes"]["taux_signature"])
        self.assertIsNone(d["commandes"]["delai_moyen_signature_jours"])
        self.assertEqual(d["top_produits"], [])
        self.assertEqual(d["montants"], {"chiffre_convenu": 0, "encaisse": 0, "reste_a_encaisser": 0,
                                         "nombre_paiements": 0, "panier_moyen": None})

    def test_fuseau_de_douala(self):
        # 23 h 30 à Douala le 31 octobre = 22 h 30 UTC : dans octobre ; 00 h 30 le 1er novembre : dans novembre
        self.commande(cree=le(2026, 10, 31, 23, 30))
        self.commande(cree=le(2026, 11, 1, 0, 30))
        octobre = self.resume(self.membre, du="2026-10-01", au="2026-10-31").data["commandes"]["total"]
        novembre = self.resume(self.membre, du="2026-11-01", au="2026-11-30").data["commandes"]["total"]
        self.assertEqual((octobre, novembre), (1, 1))
        # même règle pour l'évolution mensuelle
        evolution = self.client.get(URL + "evolution/", {"mois": 24}).data["mois"]
        par_mois = {m["mois"]: m["commandes"] for m in evolution}
        self.assertEqual(par_mois.get("2026-10"), 1)  # novembre n'a pas commencé : absent de la liste

    def test_periode_par_defaut_30_jours(self):
        d = self.resume(self.membre).data
        aujourdhui = timezone.localdate()
        self.assertEqual(d["periode"], {"du": (aujourdhui - timedelta(days=29)).isoformat(), "au": aujourdhui.isoformat()})
        ancienne = self.commande(cree=timezone.now() - timedelta(days=40))
        recente = self.commande(cree=timezone.now() - timedelta(days=2))
        cache.clear()
        self.assertEqual(self.resume(self.membre).data["commandes"]["total"], 1)

    def test_periodes_invalides(self):
        for params in ({"du": "pas-une-date"}, {"au": "2026-13-45"}, {"du": "2026-10-31", "au": "2026-10-01"},
                       {"du": "2025-01-01", "au": "2026-10-31"}, {"du": "20261001"}, {"du": "2026-1-1"}):
            with self.subTest(params=params):
                self.assertEqual(self.resume(self.membre, **params).status_code, 400)
        self.assertEqual(self.resume(self.membre, du="2025-10-30", au="2026-10-31").status_code, 400)  # 367 jours
        self.assertEqual(self.resume(self.membre, du="2025-10-31", au="2026-10-31").status_code, 200)  # 366 jours
        self.assertEqual(self.resume(self.membre, du="2025-11-01", au="2026-10-31").status_code, 200)  # 365 jours

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL + "resume/").status_code, 401)
        self.assertEqual(self.client.get(URL + "evolution/").status_code, 401)
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(URL + "resume/").status_code, 403)
        self.assertEqual(self.client.get(URL + "evolution/").status_code, 403)

    def test_requetes_bornees_et_cache(self):
        self.jeu()
        self.se_connecter(self.super_admin)
        with CaptureQueriesContext(connection) as premier:
            self.client.get(URL + "resume/", {"du": "2026-10-01", "au": "2026-10-31"})
        self.assertLessEqual(len(premier), 22)  # authentification comprise, indépendant du nombre de commandes
        for _i in range(20):
            self.commande(cree=le(2026, 10, 3))
        cache.clear()
        with CaptureQueriesContext(connection) as second:
            self.client.get(URL + "resume/", {"du": "2026-10-01", "au": "2026-10-31"})
        self.assertEqual(len(second), len(premier))
        with CaptureQueriesContext(connection) as cache_chaud:
            r = self.client.get(URL + "resume/", {"du": "2026-10-01", "au": "2026-10-31"})
        self.assertLessEqual(len(cache_chaud), 3)  # seulement l'authentification
        self.assertEqual(r.data["commandes"]["total"], 25)

    def test_cache_60_secondes(self):
        self.commande(cree=le(2026, 10, 3))
        self.assertEqual(self.resume(self.membre, du="2026-10-01", au="2026-10-31").data["commandes"]["total"], 1)
        self.commande(cree=le(2026, 10, 4))
        self.assertEqual(self.resume(self.membre, du="2026-10-01", au="2026-10-31").data["commandes"]["total"], 1)
        cache.clear()
        self.assertEqual(self.resume(self.membre, du="2026-10-01", au="2026-10-31").data["commandes"]["total"], 2)


class EvolutionTests(BaseStats):
    def test_mois_complets_et_valeurs(self):
        maintenant = timezone.localtime()
        c = self.commande(cree=timezone.now(), etat="contrat_signe", signe=timezone.now(), montant=300_000)
        self.paiement(c, 120_000, timezone.now())
        self.se_connecter(self.super_admin)
        r = self.client.get(URL + "evolution/")
        mois = r.data["mois"]
        self.assertEqual(len(mois), 12)
        self.assertEqual(mois[-1]["mois"], f"{maintenant.year}-{maintenant.month:02d}")
        self.assertEqual(mois[-1], {"mois": mois[-1]["mois"], "commandes": 1, "signees": 1, "encaisse": 120_000})
        self.assertEqual(mois[0]["commandes"], 0)
        self.assertEqual([m["mois"] for m in mois], sorted(m["mois"] for m in mois))
        self.assertEqual(len({m["mois"] for m in mois}), 12)

    def test_encaisse_cache_pour_un_membre(self):
        self.se_connecter(self.membre)
        mois = self.client.get(URL + "evolution/", {"mois": 3}).data["mois"]
        self.assertEqual(len(mois), 3)
        self.assertTrue(all(m["encaisse"] is None for m in mois))

    def test_parametre_mois(self):
        self.se_connecter(self.membre)
        for valeur in ("0", "25", "abc", "-1", "1.5"):
            self.assertEqual(self.client.get(URL + "evolution/", {"mois": valeur}).status_code, 400, valeur)
        self.assertEqual(len(self.client.get(URL + "evolution/", {"mois": 1}).data["mois"]), 1)
        self.assertEqual(len(self.client.get(URL + "evolution/", {"mois": 24}).data["mois"]), 24)
