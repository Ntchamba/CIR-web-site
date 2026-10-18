"""Négociation : calcul du total, contre-proposition, révision, acceptation, refus, signaux."""
from decimal import Decimal

from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError

from apps.commandes import negociation, services
from apps.commandes.etapes import CLIENT, EQUIPE, Etat
from apps.commandes.models import ChangementEtat, EtatProposition
from apps.commandes.signals import proposition_acceptee, proposition_refusee, proposition_remplacee
from apps.commandes.tests.outils import BaseVague2, creer_commande


class CalculTests(SimpleTestCase):
    def test_arrondi_demi_vers_le_haut(self):
        self.assertEqual(negociation.calculer_total(1000, Decimal("2.50")), 2500)
        self.assertEqual(negociation.calculer_total(15, Decimal("0.10")), 2)  # 1,5 -> 2
        self.assertEqual(negociation.calculer_total(5, Decimal("0.10")), 1)  # 0,5 -> 1
        self.assertEqual(negociation.calculer_total(3, Decimal("0.50")), 2)
        self.assertEqual(negociation.calculer_total(7, Decimal("0.07")), 0)  # 0,49
        self.assertIsNone(negociation.calculer_total(None, Decimal("10")))
        self.assertIsNone(negociation.calculer_total(100, None))

    def test_preparer_proposition(self):
        surface = Decimal("42.50")
        propre = negociation.preparer_proposition(surface, prix_m2=12000)
        self.assertEqual(propre["total"], 510000)
        propre = negociation.preparer_proposition(surface, prix_m2=12000, total=510001, message="  Bonjour ")
        self.assertEqual(propre["total"], 510001)  # écart de 1 FCFA toléré
        self.assertEqual(propre["message"], "Bonjour")
        propre = negociation.preparer_proposition(None, prix_m2=12000)
        self.assertIsNone(propre["total"])  # surface inconnue : rien d'inventé
        propre = negociation.preparer_proposition(surface, total=400000)
        self.assertIsNone(propre["prix_m2"])
        with self.assertRaises(ValidationError) as c:
            negociation.preparer_proposition(surface, prix_m2=12000, total=510002)
        self.assertIn("total", c.exception.detail)
        for mauvais in ({}, {"delai_jours": 5}, {"prix_m2": -1}, {"total": 1.5}, {"prix_m2": 10, "delai_jours": 0},
                        {"prix_m2": 10, "message": "x" * 1001}):
            with self.subTest(mauvais=mauvais), self.assertRaises(ValidationError):
                negociation.preparer_proposition(surface, **mauvais)


class ParcoursTests(BaseVague2, TestCase):
    def setUp(self):
        super().setUp()
        self.commande = creer_commande(self.client_a, self.produit, surface_m2=Decimal("40"))
        self.recus = []
        for signal, nom in [(proposition_acceptee, "acceptee"), (proposition_refusee, "refusee"),
                            (proposition_remplacee, "remplacee")]:
            def ecouteur(sender, proposition, nom=nom, **kw):
                self.recus.append((nom, proposition.pk))
            signal.connect(ecouteur, weak=False, dispatch_uid=f"test-{nom}-{id(self)}")
            self.addCleanup(signal.disconnect, dispatch_uid=f"test-{nom}-{id(self)}")

    def recharger(self):
        self.commande.refresh_from_db()
        return self.commande

    def test_premiere_proposition_ouvre_la_negociation(self):
        p = services.proposer(self.commande, self.client_a, CLIENT, {"prix_m2": 9000})
        self.assertEqual(p.total, 360000)
        self.assertEqual(self.recharger().etat, Etat.NEGOCIATION)
        historique = ChangementEtat.objects.get()
        self.assertEqual((historique.de, historique.vers, historique.auteur_role), ("nouvelle", "negociation",
                                                                                    "client"))

    def test_contre_proposition_remplace_l_ancienne(self):
        p1 = services.proposer(self.commande, self.client_a, CLIENT, {"prix_m2": 9000})
        p2 = services.proposer(self.commande, self.membre, EQUIPE, {"prix_m2": 12000, "delai_jours": 10})
        p1.refresh_from_db()
        self.assertEqual(p1.etat, EtatProposition.REMPLACEE)
        self.assertIsNotNone(p1.repondu_le)
        self.assertEqual(p2.etat, EtatProposition.EN_ATTENTE)
        self.assertEqual(self.recus, [("remplacee", p1.pk)])

    def test_revision_par_la_meme_partie(self):
        p1 = services.proposer(self.commande, self.client_a, CLIENT, {"prix_m2": 9000})
        p2 = services.proposer(self.commande, self.client_a, CLIENT, {"prix_m2": 9500})
        p1.refresh_from_db()
        self.assertEqual(p1.etat, EtatProposition.REMPLACEE)
        self.assertEqual(self.commande.propositions.filter(etat=EtatProposition.EN_ATTENTE).get().pk, p2.pk)

    def test_acceptation_fixe_le_contrat(self):
        services.proposer(self.commande, self.client_a, CLIENT, {"prix_m2": 9000})
        p = services.proposer(self.commande, self.membre, EQUIPE, {"prix_m2": 12000, "delai_jours": 15})
        services.repondre(p, self.client_a, CLIENT, True, "D'accord")
        commande = self.recharger()
        self.assertEqual(commande.etat, Etat.CONTRAT_SIGNE)
        self.assertEqual((commande.montant_convenu, commande.prix_m2_convenu, commande.delai_convenu_jours),
                         (480000, 12000, 15))
        self.assertIsNotNone(commande.signe_le)
        p.refresh_from_db()
        self.assertEqual((p.etat, p.reponse), (EtatProposition.ACCEPTEE, "D'accord"))
        self.assertIn(("acceptee", p.pk), self.recus)
        self.assertEqual(ChangementEtat.objects.filter(vers="contrat_signe").get().auteur_role, "client")
        # plus de proposition possible
        with self.assertRaises(ValidationError):
            services.proposer(commande, self.membre, EQUIPE, {"total": 1})

    def test_refus_laisse_la_commande_en_negociation(self):
        p = services.proposer(self.commande, self.client_a, CLIENT, {"total": 100000})
        services.repondre(p, self.membre, EQUIPE, False, "Trop bas")
        p.refresh_from_db()
        self.assertEqual((p.etat, p.reponse), (EtatProposition.REFUSEE, "Trop bas"))
        self.assertEqual(self.recharger().etat, Etat.NEGOCIATION)
        self.assertEqual(self.recus, [("refusee", p.pk)])
        # on peut reproposer après un refus
        services.proposer(self.commande, self.membre, EQUIPE, {"total": 300000})

    def test_reponses_interdites(self):
        p = services.proposer(self.commande, self.client_a, CLIENT, {"total": 100000})
        for accepter in (True, False):  # l'auteur ne répond pas à sa propre proposition
            with self.subTest(accepter=accepter), self.assertRaises(ValidationError):
                services.repondre(p, self.client_a, CLIENT, accepter)
        services.repondre(p, self.membre, EQUIPE, False)
        for accepter in (True, False):  # déjà traitée
            with self.subTest(deja=accepter), self.assertRaises(ValidationError):
                services.repondre(p, self.membre, EQUIPE, accepter)
        self.assertEqual(self.recharger().etat, Etat.NEGOCIATION)

    def test_acceptation_sans_montant_determinable(self):
        commande = creer_commande(self.client_a, self.produit)  # surface inconnue
        p = services.proposer(commande, self.client_a, CLIENT, {"prix_m2": 9000})
        self.assertIsNone(p.total)
        with self.assertRaises(ValidationError) as c:
            services.repondre(p, self.membre, EQUIPE, True)
        self.assertIn("surface", str(c.exception.detail["detail"]))
        commande.refresh_from_db()
        self.assertEqual(commande.etat, Etat.NEGOCIATION)
        # la surface est précisée : le montant se calcule à l'acceptation
        services.modifier_par_equipe(commande, {"surface_m2": Decimal("10")})
        services.repondre(p, self.membre, EQUIPE, True)
        commande.refresh_from_db()
        self.assertEqual(commande.montant_convenu, 90000)

    def test_annulation_refuse_la_proposition_en_attente(self):
        p = services.proposer(self.commande, self.client_a, CLIENT, {"total": 100000})
        services.annuler(self.commande, self.client_a, CLIENT, "Plus besoin")
        p.refresh_from_db()
        self.assertEqual(p.etat, EtatProposition.REFUSEE)
        self.assertEqual(self.recharger().etat, Etat.ANNULEE)
        self.assertEqual(self.recus, [("refusee", p.pk)])
