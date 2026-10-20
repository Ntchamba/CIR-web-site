"""API de l'équipe, règlement hors ligne, résumé, notifications, champs de règlement des commandes."""
from django.core import mail  # noqa: F401
from django.utils import translation

from apps.commandes.models import Commande
from apps.notifications import evenements
from apps.notifications.models import EnvoiEmail, Notification, TypeNotification as T
from apps.notifications.services import texte_notification
from apps.paiements import services
from apps.paiements.models import EtatPaiement, Paiement

from .outils import ADMIN, URL, BasePaiements, signer_commande


class EquipeTests(BasePaiements):
    def test_acces_reserve_a_l_equipe(self):
        p = self.paiement_en_base()
        self.se_connecter(self.client_a)
        for chemin in ("", "resume/", f"{p.pk}/"):
            self.assertEqual(self.client.get(ADMIN + chemin).status_code, 403, chemin)
        self.assertEqual(self.client.post(f"{ADMIN}{p.pk}/reverifier/").status_code, 403)
        r = self.client.post(f"{ADMIN}commandes/{self.commande.pk}/reglements/", {"montant": 1000,
                                                                                   "mode_manuel": "especes"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(ADMIN).status_code, 401)

    def test_liste_filtres_detail(self):
        a = self.paiement_en_base(etat=EtatPaiement.ECHOUE)
        autre = self.creer_commande_payable(self.client_b)
        b = self.paiement_en_base(commande=autre, etat=EtatPaiement.ANOMALIE, mode="lien")
        self.se_connecter(self.membre)
        r = self.client.get(ADMIN)
        self.assertEqual(r.data["count"], 2)
        premier = r.data["results"][0]
        self.assertEqual(premier["client"], {"id": self.client_b.pk, "nom_complet": "Bruno Client"})
        for cle in ("reference_campay", "reference_operateur", "saisi_par", "mode_manuel", "note",
                    "derniere_verification_le"):
            self.assertIn(cle, premier)
        self.assertEqual([p["id"] for p in self.client.get(ADMIN + "?etat=anomalie").data["results"]], [b.pk])
        self.assertEqual([p["id"] for p in self.client.get(ADMIN + "?mode=mobile").data["results"]], [a.pk])
        self.assertEqual([p["id"] for p in self.client.get(f"{ADMIN}?commande={self.commande.pk}").data["results"]], [a.pk])
        for terme in (a.reference, self.commande.reference, "Bruno"):
            self.assertGreaterEqual(self.client.get(ADMIN, {"search": terme}).data["count"], 1, terme)
        self.assertEqual(self.client.get(f"{ADMIN}{a.pk}/").status_code, 200)
        self.assertEqual(self.client.get(f"{ADMIN}999999/").status_code, 404)
        self.assertNotIn("699001122", self.client.get(ADMIN).content.decode())

    def test_reverifier(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        self.se_connecter(self.membre)
        r = self.client.post(f"{ADMIN}{p.pk}/reverifier/")
        self.assertEqual((r.status_code, r.data["etat"]), (200, "reussi"))
        self.assertEqual(self.client.post(f"{ADMIN}{p.pk}/reverifier/").status_code, 409)  # déjà réussi

    def test_resume_somme_reservee_au_super_admin(self):
        self.paiement_en_base()
        self.paiement_en_base(etat=EtatPaiement.ANOMALIE)
        from django.utils import timezone
        self.paiement_en_base(etat=EtatPaiement.REUSSI, montant=70_000, termine_le=timezone.now())
        self.se_connecter(self.membre)
        r = self.client.get(ADMIN + "resume/")
        self.assertEqual(r.data, {"en_attente": 1, "anomalies": 1, "encaisse_mois": None})
        self.se_connecter(self.super_admin)
        self.assertEqual(self.client.get(ADMIN + "resume/").data["encaisse_mois"], 70_000)


class ReglementTests(BasePaiements):
    def poster(self, utilisateur=None, commande=None, **donnees):
        self.se_connecter(utilisateur or self.membre)
        corps = {"montant": 200_000, "mode_manuel": "virement", "note": "Virement du 20/10", **donnees}
        return self.client.post(f"{ADMIN}commandes/{(commande or self.commande).pk}/reglements/", corps, format="json")

    def test_reglement_hors_ligne(self):
        r = self.poster()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["etat"], r.data["mode"], r.data["mode_manuel"], r.data["note"]),
                         ("reussi", "manuel", "virement", "Virement du 20/10"))
        self.assertEqual(r.data["saisi_par"], {"id": self.membre.pk, "nom_complet": self.membre.nom_complet})
        c = Commande.objects.get(pk=self.commande.pk)
        self.assertEqual(c.montant_paye, 200_000)
        self.campay.statut.assert_not_called()
        p = Paiement.objects.get()
        self.assertEqual(p.client, self.client_a)
        services.verifier(p)  # jamais revérifié
        self.campay.statut.assert_not_called()
        self.assertEqual(self.poster(montant=300_000).status_code, 201)  # solde exact
        self.assertEqual(Commande.objects.get(pk=self.commande.pk).montant_paye, 500_000)

    def test_fonctionne_sans_campay(self):
        self.campay.configure.return_value = False
        self.assertEqual(self.poster().status_code, 201)

    def test_limites(self):
        for montant in (0, -1, 500_001, "12.5", True, "abc"):
            with self.subTest(montant=montant):
                r = self.poster(montant=montant)
                self.assertEqual(r.status_code, 400)
                self.assertIn("montant", r.data)
        self.assertEqual(self.poster(mode_manuel="troc").status_code, 400)
        self.assertEqual(self.poster(note="x" * 301).status_code, 400)
        self.assertEqual(Paiement.objects.count(), 0)

    def test_etapes_interdites(self):
        for etat in ("nouvelle", "negociation", "annulee"):
            signer_commande(self.commande, etat=etat)
            r = self.poster()
            self.assertEqual((r.status_code, r.data["code"]), (409, "paiement_non_autorise"))
        signer_commande(self.commande, paye=500_000)
        self.assertEqual(self.poster().status_code, 409)

    def test_commande_inconnue(self):
        self.se_connecter(self.membre)
        r = self.client.post(f"{ADMIN}commandes/999999/reglements/", {"montant": 1000, "mode_manuel": "especes"},
                             format="json")
        self.assertEqual(r.status_code, 404)

    def test_notifications_du_reglement(self):
        self.poster()
        self.assertEqual(Notification.objects.filter(type=T.PAIEMENT_RECU, utilisateur=self.client_a).count(), 1)
        self.assertEqual(Notification.objects.filter(type=T.PAIEMENT_RECU_EQUIPE).count(), 2)  # membre + super admin


class NotificationsPaiementTests(BasePaiements):
    def test_reussite_prevenir_client_et_equipe_avec_e_mail(self):
        p = self.paiement_en_base()
        self.annoncer(p)
        services.verifier(p)
        n = Notification.objects.get(type=T.PAIEMENT_RECU)
        self.assertEqual(n.utilisateur, self.client_a)
        self.assertEqual(n.donnees["reste_a_payer"], 400_000)
        self.assertEqual(Notification.objects.filter(type=T.PAIEMENT_RECU_EQUIPE).count(), 2)
        courriel = EnvoiEmail.objects.get(evenement=T.PAIEMENT_RECU)
        self.assertEqual(courriel.destinataire_email, self.client_a.email)
        self.assertIn("100\u202f000", courriel.corps_texte)
        self.assertIn("400\u202f000", courriel.corps_texte)
        self.assertIn(p.reference, courriel.corps_texte)
        self.assertEqual(EnvoiEmail.objects.filter(evenement=T.PAIEMENT_RECU_EQUIPE).count(), 2)
        services.verifier(p)  # pas de doublon
        self.assertEqual(Notification.objects.filter(type=T.PAIEMENT_RECU).count(), 1)

    def test_equipe_sans_e_mail_si_preference_desactivee(self):
        self.membre.email_equipe = False
        self.membre.save()
        p = self.paiement_en_base()
        self.annoncer(p)
        services.verifier(p)
        self.assertFalse(EnvoiEmail.objects.filter(destinataire_email=self.membre.email,
                                                      evenement=T.PAIEMENT_RECU_EQUIPE).exists())
        self.assertTrue(Notification.objects.filter(utilisateur=self.membre, type=T.PAIEMENT_RECU_EQUIPE).exists())

    def test_echec_sans_e_mail(self):
        p = self.paiement_en_base()
        self.annoncer(p, "echoue")
        services.verifier(p)
        self.assertEqual(Notification.objects.filter(type=T.PAIEMENT_ECHOUE, utilisateur=self.client_a).count(), 1)
        self.assertFalse(EnvoiEmail.objects.filter(evenement=T.PAIEMENT_ECHOUE).exists())

    def test_anomalie_vers_l_equipe_seulement(self):
        p = self.paiement_en_base()
        self.annoncer(p, montant=1)
        services.verifier(p)
        self.assertEqual(Notification.objects.filter(type=T.PAIEMENT_ANOMALIE).count(), 2)
        self.assertFalse(Notification.objects.filter(utilisateur=self.client_a, type=T.PAIEMENT_ANOMALIE).exists())
        self.assertEqual(EnvoiEmail.objects.filter(evenement=T.PAIEMENT_ANOMALIE).count(), 2)
        self.assertFalse(Notification.objects.filter(type=T.PAIEMENT_RECU).exists())

    def test_textes_dans_les_cinq_langues(self):
        donnees = {"commande": 3, "reference": "CIR-2026-0003", "nom": "Alice", "montant": 100000}
        for type_ in (T.PAIEMENT_RECU, T.PAIEMENT_RECU_EQUIPE, T.PAIEMENT_ECHOUE, T.PAIEMENT_ANOMALIE):
            vus = set()
            for langue in ("fr", "en", "zh-hans", "de", "ja"):
                with translation.override(langue):
                    titre, texte, lien = texte_notification(type_, donnees)
                self.assertIn("CIR-2026-0003", titre + texte)
                self.assertNotIn("{", titre + texte)
                self.assertEqual(lien, "/commandes/3")
                vus.add(titre)
            self.assertEqual(len(vus), 5, type_)

    def test_modeles_d_e_mail(self):
        self.assertIn(T.PAIEMENT_RECU, evenements.EVENEMENTS)
        self.assertIn(T.PAIEMENT_ANOMALIE, evenements.EVENEMENTS)
        self.assertNotIn(T.PAIEMENT_ECHOUE, evenements.EVENEMENTS)


class ReglementCommandeTests(BasePaiements):
    def test_champs_dans_les_formats_client_et_equipe(self):
        from apps.commandes.tests.outils import creer_commande
        nouvelle = creer_commande(self.client_a, self.produit if hasattr(self, "produit") else
                                  __import__("apps.catalogue.models", fromlist=["Produit"]).Produit.objects.first())
        Commande.objects.filter(pk=self.commande.pk).update(montant_paye=125_000)
        self.se_connecter(self.client_a)
        d = self.client.get(f"/api/commandes/{self.commande.pk}/").data
        self.assertEqual((d["montant_paye"], d["reste_a_payer"], d["statut_paiement"]), (125_000, 375_000, "partiel"))
        n = self.client.get(f"/api/commandes/{nouvelle.pk}/").data
        self.assertEqual((n["montant_paye"], n["reste_a_payer"], n["statut_paiement"]), (0, None, "non_applicable"))
        liste = {c["id"]: c for c in self.client.get("/api/commandes/").data["results"]}
        self.assertEqual(liste[self.commande.pk]["statut_paiement"], "partiel")
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(f"/api/admin/commandes/{self.commande.pk}/").data["reste_a_payer"], 375_000)

    def test_filtre_paiement(self):
        non_paye = self.commande
        partiel = self.creer_commande_payable(self.client_a, montant=100_000)
        Commande.objects.filter(pk=partiel.pk).update(montant_paye=40_000)
        paye = self.creer_commande_payable(self.client_b, montant=100_000)
        Commande.objects.filter(pk=paye.pk).update(montant_paye=100_000)
        self.creer_commande_payable(self.client_b, montant=100_000, etat="negociation")  # non applicable
        self.se_connecter(self.membre)
        for valeur, attendu in (("non_paye", non_paye), ("partiel", partiel), ("paye", paye)):
            r = self.client.get(f"/api/admin/commandes/?paiement={valeur}")
            self.assertEqual([c["id"] for c in r.data["results"]], [attendu.pk], valeur)
        self.assertEqual(self.client.get("/api/admin/commandes/?paiement=nimporte").data["count"], 4)
