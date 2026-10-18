"""Machine à états : toutes les transitions du tableau du contrat, autorisées et interdites."""
from itertools import product

from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError

from apps.commandes.etapes import CLIENT, EQUIPE, TRANSITIONS, Etat, actions_possibles, changer_etat, transition_permise
from apps.commandes.models import ChangementEtat
from apps.commandes.tests.outils import BaseVague2, creer_commande


class TableauDesTransitionsTests(SimpleTestCase):
    # (de, vers, rôles autorisés à la main, interne)
    ATTENDU = {
        ("nouvelle", "negociation"): (set(), True),
        ("nouvelle", "annulee"): ({CLIENT, EQUIPE}, False),
        ("negociation", "annulee"): ({CLIENT, EQUIPE}, False),
        ("negociation", "contrat_signe"): (set(), True),
        ("contrat_signe", "travaux"): ({EQUIPE}, False),
        ("contrat_signe", "annulee"): ({EQUIPE}, False),
        ("travaux", "terminee"): ({EQUIPE}, False),
    }

    def test_toutes_les_paires(self):
        for de, vers in product(Etat.values, repeat=2):
            for role in (CLIENT, EQUIPE):
                a_la_main, interne = self.ATTENDU.get((de, vers), (set(), False))
                with self.subTest(de=de, vers=vers, role=role):
                    self.assertEqual(transition_permise(de, vers, role), role in a_la_main)
                    regle = TRANSITIONS.get((de, vers))
                    self.assertEqual(transition_permise(de, vers, role, interne=True),
                                     regle is not None and role in regle.roles)

    def test_etats_definitifs_sans_sortie(self):
        for de, vers in TRANSITIONS:
            self.assertNotIn(de, (Etat.TERMINEE, Etat.ANNULEE))

    def test_actions_possibles(self):
        self.assertEqual(actions_possibles("nouvelle", CLIENT), ["modifier", "annuler", "proposer"])
        self.assertEqual(actions_possibles("negociation", CLIENT), ["annuler", "proposer"])
        for etat in ("contrat_signe", "travaux", "terminee", "annulee"):
            self.assertEqual(actions_possibles(etat, CLIENT), [])
        self.assertEqual(actions_possibles("nouvelle", EQUIPE), ["modifier", "annuler", "proposer"])
        self.assertEqual(actions_possibles("negociation", EQUIPE), ["modifier", "annuler", "proposer"])
        self.assertEqual(actions_possibles("contrat_signe", EQUIPE), ["annuler", "demarrer_travaux"])
        self.assertEqual(actions_possibles("travaux", EQUIPE), ["terminer"])
        self.assertEqual(actions_possibles("terminee", EQUIPE), [])
        self.assertEqual(actions_possibles("annulee", EQUIPE), [])


class ChangerEtatTests(BaseVague2, TestCase):
    def test_historique_et_refus(self):
        commande = creer_commande(self.client_a, self.produit)
        changer_etat(commande, Etat.ANNULEE, role=CLIENT, auteur=self.client_a, motif="Changement de projet")
        ligne = ChangementEtat.objects.get()
        self.assertEqual((ligne.de, ligne.vers, ligne.auteur_role, ligne.motif),
                         ("nouvelle", "annulee", "client", "Changement de projet"))
        with self.assertRaises(ValidationError):
            changer_etat(commande, Etat.TRAVAUX, role=EQUIPE, auteur=self.membre)
        self.assertEqual(ChangementEtat.objects.count(), 1)

    def test_negociation_et_contrat_jamais_a_la_main(self):
        commande = creer_commande(self.client_a, self.produit)
        for vers in (Etat.NEGOCIATION, Etat.CONTRAT_SIGNE):
            with self.subTest(vers=vers), self.assertRaises(ValidationError):
                changer_etat(commande, vers, role=EQUIPE, auteur=self.membre)
