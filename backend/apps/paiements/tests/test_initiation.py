"""Initiation d'un paiement par le client : règles, erreurs, CamPay simulé."""
from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

from apps.paiements.models import EtatPaiement, ModePaiement, Paiement
from integrations.campay.erreurs import CampayErreurDefinitive, CampayErreurTemporaire

from .outils import ADMIN, TEL, URL, BasePaiements, signer_commande


class DisponibiliteTests(BasePaiements):
    def test_disponibilite(self):
        self.se_connecter(self.client_a)
        r = self.client.get(URL + "disponibilite/")
        self.assertEqual(r.data, {"configure": True, "montant_minimum": 100, "expiration_minutes": 15})
        self.campay.configure.return_value = False
        r = self.client.get(URL + "disponibilite/")
        self.assertEqual((r.data["configure"], r.data["montant_minimum"], r.data["expiration_minutes"]),
                         (False, 100, 15))

    @override_settings(PAIEMENT_MONTANT_MINIMUM=250, PAIEMENT_EXPIRATION_MINUTES=7)
    def test_valeurs_des_reglages(self):
        self.se_connecter(self.client_a)
        r = self.client.get(URL + "disponibilite/")
        self.assertEqual((r.data["montant_minimum"], r.data["expiration_minutes"]), (250, 7))

    def test_non_configure(self):
        self.campay.configure.return_value = False
        r = self.initier()
        self.assertEqual((r.status_code, r.data["code"]), (503, "paiements_non_configures"))
        self.assertEqual(Paiement.objects.count(), 0)
        self.campay.initier_collecte.assert_not_called()


class InitierTests(BasePaiements):
    def test_mobile_reussi(self):
        r = self.initier()
        self.assertEqual(r.status_code, 201, r.content)
        d = r.data
        self.assertRegex(d["reference"], r"^PAY-\d{4}-0001$")
        self.assertEqual((d["montant"], d["devise"], d["mode"], d["etat"]), (500_000, "XAF", "mobile", "en_attente"))
        self.assertEqual((d["telephone_masque"], d["code_ussd"], d["operateur"]), ("+237 6** ** ** 22", "*126#", "MTN"))
        self.assertEqual(d["commande"], {"id": self.commande.pk, "reference": self.commande.reference})
        self.assertFalse(d["peut_annuler"])
        self.assertEqual(set(d), {"id", "reference", "commande", "montant", "devise", "mode", "mode_libelle", "etat",
                                  "etat_libelle", "operateur", "telephone_masque", "code_ussd", "lien", "raison",
                                  "raison_libelle", "cree_le", "termine_le", "peut_annuler"})
        texte = r.content.decode()
        for secret in ("699001122", "ref-campay-0001"):
            self.assertNotIn(secret, texte)
        p = Paiement.objects.get()
        self.assertEqual((p.telephone, p.reference_campay), ("237699001122", "ref-campay-0001"))
        arguments = self.campay.initier_collecte.call_args.kwargs
        self.assertEqual((arguments["montant"], arguments["telephone"], arguments["reference_externe"]),
                         (500_000, "237699001122", p.reference_externe))
        self.assertIsInstance(arguments["montant"], int)

    def test_montant_partiel_et_libelles_traduits(self):
        self.se_connecter(self.client_a)
        r = self.client.post(URL, {"commande": self.commande.pk, "telephone": TEL, "montant": 150_000},
                             format="json", headers={"Accept-Language": "en"})
        self.assertEqual((r.status_code, r.data["montant"], r.data["etat_libelle"]), (201, 150_000, "Pending"))

    def test_mode_lien(self):
        r = self.initier(mode="lien", telephone=None)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["lien"], r.data["peut_annuler"], r.data["telephone_masque"]),
                         ("https://campay.example/pay/abc", True, None))
        p = Paiement.objects.get()
        retour = self.campay.lien_paiement.call_args.kwargs["url_retour"]
        self.assertTrue(retour.endswith(f"/commandes/{self.commande.pk}/payer?paiement={p.pk}"), retour)
        self.campay.initier_collecte.assert_not_called()

    def test_etapes_interdites(self):
        for etat in ("nouvelle", "negociation", "annulee"):
            with self.subTest(etat=etat):
                signer_commande(self.commande, etat=etat)
                r = self.initier()
                self.assertEqual((r.status_code, r.data["code"]), (409, "paiement_non_autorise"))
        self.assertEqual(Paiement.objects.count(), 0)

    def test_etapes_autorisees(self):
        for etat in ("travaux", "terminee"):
            with self.subTest(etat=etat):
                signer_commande(self.commande, etat=etat)
                Paiement.objects.all().delete()
                self.assertEqual(self.initier().status_code, 201)

    def test_sans_montant_convenu_ou_rien_a_payer(self):
        from apps.commandes.models import Commande
        Commande.objects.filter(pk=self.commande.pk).update(montant_convenu=None)
        self.assertEqual(self.initier().data["code"], "paiement_non_autorise")
        signer_commande(self.commande, paye=500_000)
        self.assertEqual(self.initier().data["code"], "paiement_non_autorise")

    def test_montants(self):
        signer_commande(self.commande, montant=10_000, paye=4_000)  # reste : 6 000
        for montant, attendu in ((99, 400), (6_001, 400), (0, 400), (-5, 400), ("12.5", 400), (True, 400), ("abc", 400),
                                 (5_000_000_000, 400)):
            with self.subTest(montant=montant):
                r = self.initier(montant=montant)
                self.assertEqual(r.status_code, attendu)
                self.assertIn("montant", r.data)
        self.assertEqual(Paiement.objects.count(), 0)
        self.assertEqual(self.initier(montant=100).status_code, 201)

    def test_reste_inferieur_au_minimum(self):
        signer_commande(self.commande, montant=10_000, paye=9_950)  # reste : 50, sous le minimum de 100
        r = self.initier()
        self.assertEqual((r.status_code, r.data["montant"]), (201, 50))

    def test_telephone(self):
        for tel in ("12345", "+33 6 12 34 56 78", "", None, "abc"):
            with self.subTest(tel=tel):
                r = self.initier(telephone=tel)
                self.assertEqual(r.status_code, 400)
                self.assertIn("telephone", r.data)
        for tel in ("+237 699001122", "00237699001122", "237699001122"):
            Paiement.objects.all().delete()
            self.assertEqual(self.initier(telephone=tel).status_code, 201)

    def test_un_seul_paiement_en_attente(self):
        self.assertEqual(self.initier().status_code, 201)
        r = self.initier()
        self.assertEqual((r.status_code, r.data["code"]), (409, "paiement_en_cours"))
        self.assertEqual(Paiement.objects.count(), 1)

    def test_paiement_expire_clos_avant_un_nouveau(self):
        self.assertEqual(self.initier().status_code, 201)
        Paiement.objects.update(cree_le=timezone.now() - timedelta(minutes=16), derniere_verification_le=None)
        r = self.initier()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Paiement.objects.filter(etat=EtatPaiement.EXPIRE).count(), 1)

    def test_quota(self):
        for _i in range(5):
            self.paiement_en_base(etat=EtatPaiement.ECHOUE)
        r = self.initier()
        self.assertEqual((r.status_code, r.data["code"]), (429, "trop_de_paiements"))
        Paiement.objects.update(cree_le=timezone.now() - timedelta(hours=2))
        self.assertEqual(self.initier().status_code, 201)

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(URL, {}, format="json").status_code, 401)
        r = self.initier(self.membre)
        self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))
        r = self.initier(self.client_b)  # commande d'un autre
        self.assertEqual(r.status_code, 404)
        self.assertEqual(self.initier(commande=999999).status_code, 404)
        self.assertEqual(Paiement.objects.count(), 0)

    def test_mode_manuel_refuse_au_client(self):
        r = self.initier(mode="manuel")
        self.assertEqual(r.status_code, 400)

    def test_erreur_temporaire_aucun_paiement(self):
        self.campay.initier_collecte.side_effect = CampayErreurTemporaire("réseau")
        r = self.initier()
        self.assertEqual((r.status_code, r.data["code"]), (503, "paiements_indisponibles"))
        self.assertEqual(Paiement.objects.count(), 0)
        self.campay.initier_collecte.side_effect = self._collecte  # CamPay répond de nouveau
        self.assertEqual(self.initier().status_code, 201)

    def test_erreur_definitive_paiement_echoue(self):
        self.campay.initier_collecte.side_effect = CampayErreurDefinitive("refusé", "numero_invalide")
        r = self.initier()
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.data["etat"], r.data["raison"]), ("echoue", "numero_invalide"))
        self.assertTrue(r.data["raison_libelle"])
        self.assertEqual(self.commande.__class__.objects.get(pk=self.commande.pk).montant_paye, 0)
        self.campay.initier_collecte.side_effect = self._collecte  # CamPay répond de nouveau
        self.assertEqual(self.initier().status_code, 201)  # plus de paiement en attente

    def test_diffusion_en_direct(self):
        self.initier()
        client = self.trames(groupe=f"utilisateur_{self.client_a.pk}", type="paiement_mis_a_jour")
        equipe = self.trames(groupe="equipe", type="paiement_mis_a_jour")
        self.assertEqual((len(client), len(equipe)), (1, 1))
        self.assertEqual(client[0][2]["paiement"]["etat"], "en_attente")
        self.assertNotIn("reference_campay", client[0][2]["paiement"])
        self.assertIn("reference_campay", equipe[0][2]["paiement"])


class ListeClientTests(BasePaiements):
    def test_liste_detail_et_isolation(self):
        a = self.paiement_en_base(etat=EtatPaiement.ECHOUE)
        autre = self.creer_commande_payable(self.client_b)
        b = self.paiement_en_base(commande=autre, etat=EtatPaiement.ECHOUE)
        self.se_connecter(self.client_a)
        r = self.client.get(URL)
        self.assertEqual([p["id"] for p in r.data["results"]], [a.pk])
        self.assertEqual(len(self.client.get(f"{URL}?etat=reussi").data["results"]), 0)
        self.assertEqual(len(self.client.get(f"{URL}?commande={self.commande.pk}").data["results"]), 1)
        self.assertEqual(self.client.get(f"{URL}{a.pk}/").status_code, 200)
        for chemin in (f"{URL}{b.pk}/", f"{URL}{b.pk}/recu/"):
            self.assertEqual(self.client.get(chemin).status_code, 404)
        self.assertEqual(self.client.post(f"{URL}{b.pk}/annuler/").status_code, 404)
