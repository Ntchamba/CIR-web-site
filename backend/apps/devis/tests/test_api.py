"""API des devis : client, équipe, demandes de rendu, envoi et signaux."""
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.catalogue.models import Produit
from apps.commandes.models import EtatProposition
from apps.commandes.tests.outils import BaseVague2, creer_commande, image_png
from apps.devis.models import DemandeRendu, Devis

URL = "/api/devis/"
URL_ADMIN = "/api/admin/devis/"
CMD = "/api/commandes/"
CMD_ADMIN = "/api/admin/commandes/"
DESC = "Je voudrais un rendu époxy pour mon salon de vingt mètres carrés."
LIGNES = [{"type_ligne": "surface", "libelle": "Pose", "surface_m2": "20", "prix_m2": 12000},
          {"type_ligne": "forfait", "libelle": "Transport", "montant_forfait": 10000}]


class Base(BaseVague2):
    def setUp(self):
        super().setUp()
        self.commande = creer_commande(self.client_a, self.produit, surface_m2="20")

    def devis(self, **plus):
        self.se_connecter(self.membre)
        r = self.client.post(URL_ADMIN, {"commande": self.commande.pk, "lignes": LIGNES, "notes": "Valable", **plus},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.data


class DevisEquipeTests(Base):
    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 401)
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(URL_ADMIN).status_code, 403)

    def test_creation_brouillon_et_calcul(self):
        d = self.devis()
        self.assertRegex(d["reference"], r"^DEV-\d{4}-0001$")
        self.assertEqual((d["etat"], d["total"], d["complet"], d["valide_jusqu_au"], d["expire"]),
                         ("brouillon", "250000", True, None, False))
        self.assertEqual(d["lignes"][0]["montant"], "240000")
        self.assertEqual(set(d["lignes"][1]), {"id", "ordre", "type_ligne", "libelle", "surface_m2", "dosage_kg_m2",
                                               "quantite_kg", "prix_kg", "prix_m2", "montant", "produit", "libelle_affiche",
                                               "montant_forfait"})
        self.assertEqual(d["cree_par"]["id"], self.membre.pk)

    def test_commande_terminee_refusee(self):
        self.commande.etat = "annulee"
        self.commande.save()
        self.se_connecter(self.membre)
        r = self.client.post(URL_ADMIN, {"commande": self.commande.pk, "lignes": LIGNES}, format="json")
        self.assertEqual((r.status_code, "commande" in r.data), (400, True))

    def test_libelle_vide_prend_le_nom_du_produit(self):
        d = self.devis(lignes=[{"type_ligne": "forfait", "produit": self.produit.pk, "montant_forfait": 5}])
        self.assertEqual(d["lignes"][0]["libelle_affiche"], "Sol autolissant")
        d2 = self.client.get(f"{URL_ADMIN}{d['id']}/", HTTP_ACCEPT_LANGUAGE="en").data
        self.assertEqual(d2["lignes"][0]["libelle_affiche"], "Self-levelling floor")
        self.assertEqual(d2["lignes"][0]["libelle"], "")

    def test_modification_remplace_les_lignes_seulement_en_brouillon(self):
        d = self.devis()
        r = self.client.patch(f"{URL_ADMIN}{d['id']}/", {"lignes": LIGNES[:1], "validite_jours": 10}, format="json")
        self.assertEqual((r.status_code, len(r.data["lignes"]), r.data["total"]), (200, 1, "240000"))
        self.assertEqual(self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/").status_code, 200)
        self.assertEqual(self.client.patch(f"{URL_ADMIN}{d['id']}/", {"notes": "x"}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"{URL_ADMIN}{d['id']}/").status_code, 400)

    def test_suppression_du_brouillon(self):
        d = self.devis()
        self.assertEqual(self.client.delete(f"{URL_ADMIN}{d['id']}/").status_code, 204)
        self.assertEqual(Devis.objects.count(), 0)

    def test_calculer(self):
        self.se_connecter(self.membre)
        r = self.client.post(f"{URL_ADMIN}calculer/", {"lignes": [
            {"type_ligne": "materiau", "surface_m2": "42.5", "dosage_kg_m2": "0.35", "prix_kg": 4500},
            {"type_ligne": "surface", "surface_m2": "10"}]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.data["total"], r.data["complet"]), ("66960", False))
        self.assertEqual(r.data["lignes"][0]["quantite_kg"], "14.88")
        self.assertIsNone(r.data["lignes"][1]["montant"])
        self.assertEqual((r.data["erreurs"][0]["ligne"], r.data["erreurs"][0]["champ"]), (1, "prix_m2"))
        self.assertEqual(Devis.objects.count(), 0)
        self.assertEqual(self.client.post(f"{URL_ADMIN}calculer/", {"lignes": [{"type_ligne": "zz"}]},
                                          format="json").status_code, 400)

    def test_libelle_brut_equipe_et_libelle_affiche(self):
        d = self.devis(lignes=[{"type_ligne": "forfait", "produit": self.produit.pk, "montant_forfait": 5}])
        ligne = d["lignes"][0]
        self.assertEqual((ligne["libelle"], ligne["libelle_affiche"]), ("", "Sol autolissant"))
        self.se_connecter(self.membre)
        self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
        self.se_connecter(self.client_a)  # le client garde `libelle` = texte affiché
        lc = self.client.get(f"{URL}{d['id']}/").data["lignes"][0]
        self.assertEqual(lc["libelle"], "Sol autolissant")
        self.assertNotIn("libelle_affiche", lc)

    def test_erreurs_d_envoi_avec_ligne_entiere(self):
        d = self.devis(lignes=[{"type_ligne": "surface", "libelle": "x", "surface_m2": "5"}])
        r = self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
        self.assertEqual(r.status_code, 400)
        self.assertIs(type(r.json()["erreurs"][0]["ligne"]), int)

    def test_envoi_incomplet_refuse(self):
        for lignes in ([], [{"type_ligne": "surface", "libelle": "x", "surface_m2": "5"}],
                       [{"type_ligne": "forfait", "libelle": "x", "montant_forfait": 0}],
                       [{"type_ligne": "forfait", "montant_forfait": 10}]):
            with self.subTest(lignes=lignes):
                d = self.devis(lignes=lignes)
                r = self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
                self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(self.commande.propositions.count(), 0)

    def test_filtres(self):
        d = self.devis()
        self.assertEqual(self.client.get(f"{URL_ADMIN}?commande={self.commande.pk}").data["count"], 1)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?etat=envoye").data["count"], 0)
        self.assertEqual(self.client.get(f"{URL_ADMIN}?search={d['reference']}").data["count"], 1)


class EnvoiEtSignauxTests(Base):
    def test_envoi_cree_une_proposition_et_le_client_accepte(self):
        d = self.devis()
        r = self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
        self.assertEqual((r.status_code, r.data["etat"]), (200, "envoye"))
        self.assertIsNotNone(r.data["valide_jusqu_au"])
        p = self.commande.propositions.get()
        self.assertEqual((p.auteur_role, p.total, p.message, p.devis_id, p.etat),
                         ("equipe", 250000, "Valable", d["id"], "en_attente"))
        self.commande.refresh_from_db()
        self.assertEqual(self.commande.etat, "negociation")
        # le client voit le devis (liste, détail, commande)
        self.se_connecter(self.client_a)
        liste = self.client.get(URL).data
        self.assertEqual(liste["count"], 1)
        self.assertEqual(set(liste["results"][0]), {"id", "reference", "commande", "commande_reference", "etat",
                                                    "expire", "total", "valide_jusqu_au", "envoye_le"})
        detail = self.client.get(f"{URL}{d['id']}/").data
        self.assertEqual(set(detail["lignes"][0]), {"ordre", "type_ligne", "libelle", "surface_m2", "dosage_kg_m2",
                                                    "quantite_kg", "prix_kg", "prix_m2", "montant"})
        self.assertEqual(detail["notes"], "Valable")
        cmd = self.client.get(f"{CMD}{self.commande.pk}/").data
        self.assertEqual([x["id"] for x in cmd["devis"]], [d["id"]])
        self.assertEqual(cmd["propositions"][0]["devis"], d["id"])
        r = self.client.post(f"{CMD}{self.commande.pk}/propositions/{p.pk}/accepter/", {}, format="json")
        self.assertEqual((r.data["etat"], r.data["montant_convenu"]), ("contrat_signe", "250000"))
        self.assertEqual(Devis.objects.get().etat, "accepte")

    def test_refus_et_remplacement(self):
        d1 = self.devis()
        self.client.post(f"{URL_ADMIN}{d1['id']}/envoyer/")
        p1 = self.commande.propositions.get()
        self.se_connecter(self.client_a)
        self.client.post(f"{CMD}{self.commande.pk}/propositions/{p1.pk}/refuser/", {}, format="json")
        self.assertEqual(Devis.objects.get(pk=d1["id"]).etat, "refuse")
        d2 = self.devis()
        self.client.post(f"{URL_ADMIN}{d2['id']}/envoyer/")
        d3 = self.devis()
        self.client.post(f"{URL_ADMIN}{d3['id']}/envoyer/")  # remplace d2 (révision de l'équipe)
        self.assertEqual(sorted(Devis.objects.values_list("etat", flat=True)), ["envoye", "refuse", "remplace"])
        self.assertEqual(self.commande.propositions.filter(etat=EtatProposition.EN_ATTENTE).count(), 1)
        # une contre-proposition du client remplace aussi le devis en attente
        self.se_connecter(self.client_a)
        self.client.post(f"{CMD}{self.commande.pk}/propositions/", {"total": 100000}, format="json")
        self.assertEqual(Devis.objects.get(pk=d3["id"]).etat, "remplace")

    def test_annulation_de_la_commande_refuse_le_devis(self):
        d = self.devis()
        self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
        self.client.post(f"{CMD_ADMIN}{self.commande.pk}/etat/", {"etat": "annulee"}, format="json")
        self.assertEqual(Devis.objects.get().etat, "refuse")

    def test_envoi_deux_fois_et_demande_liee(self):
        demande = DemandeRendu.objects.create(client=self.client_a, description=DESC, type_batiment="maison")
        d = self.devis(demande=demande.pk)
        self.assertEqual(self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/").status_code, 200)
        self.assertEqual(self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/").status_code, 400)
        demande.refresh_from_db()
        self.assertEqual(demande.etat, "devis_envoye")

    def test_demande_d_un_autre_client_refusee(self):
        demande = DemandeRendu.objects.create(client=self.client_b, description=DESC, type_batiment="maison")
        self.se_connecter(self.membre)
        r = self.client.post(URL_ADMIN, {"commande": self.commande.pk, "demande": demande.pk, "lignes": LIGNES},
                             format="json")
        self.assertEqual((r.status_code, "demande" in r.data), (400, True))

    def test_expire(self):
        d = self.devis(validite_jours=1)
        self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
        from datetime import timedelta
        from django.utils import timezone
        Devis.objects.update(envoye_le=timezone.now() - timedelta(days=3))
        self.se_connecter(self.client_a)
        self.assertTrue(self.client.get(f"{URL}{d['id']}/").data["expire"])


class DevisClientTests(Base):
    def test_isolation_et_brouillons_masques(self):
        brouillon = self.devis()
        envoye = self.devis()
        self.client.post(f"{URL_ADMIN}{envoye['id']}/envoyer/")
        self.se_connecter(self.client_b)
        self.assertEqual(self.client.get(URL).data["count"], 0)
        self.assertEqual(self.client.get(f"{URL}{envoye['id']}/").status_code, 404)
        self.se_connecter(self.client_a)
        self.assertEqual([x["id"] for x in self.client.get(URL).data["results"]], [envoye["id"]])
        self.assertEqual(self.client.get(f"{URL}{brouillon['id']}/").status_code, 404)
        self.assertEqual(self.client.post(URL, {}, format="json").status_code, 405)
        cmd = self.client.get(f"{CMD}{self.commande.pk}/").data
        self.assertEqual(len(cmd["devis"]), 1)
        self.se_connecter(self.membre)
        self.assertEqual(len(self.client.get(f"{CMD_ADMIN}{self.commande.pk}/").data["devis"]), 2)

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_liste_sans_requete_par_devis(self):
        for _i in range(4):
            d = self.devis()
            self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")
        self.se_connecter(self.client_a)
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(self.client.get(URL).data["count"], 4)
        self.assertLessEqual(len(ctx), 5)


class DemandesRenduTests(Base):
    def deposer(self, **plus):
        donnees = {"description": DESC, "type_batiment": "maison", **plus}
        return self.client.post(f"{URL}demandes-rendu/", donnees, format="multipart")

    def test_depot_avec_images_et_detail(self):
        self.se_connecter(self.client_a)
        r = self.deposer(surface_m2="20", produit=self.produit.pk, commande=self.commande.pk,
                         images=[image_png("a.png"), image_png("b.png")])
        self.assertEqual(r.status_code, 201, r.content)
        d = r.data
        self.assertRegex(d["reference"], r"^REN-\d{4}-0001$")
        self.assertEqual((d["etat"], d["commande"], d["produit"]["reference"], d["devis"]),
                         ("nouvelle", self.commande.pk, "YD-500", []))
        self.assertEqual(len(d["images"]), 2)
        self.assertTrue(d["images"][0]["url"].startswith("http://testserver/media/devis/demandes/"))
        self.assertTrue(d["images"][0]["url"].endswith(".webp"))
        self.assertEqual(d["images"][0]["alt"], "")
        self.assertNotIn("notes_internes", d)
        self.assertEqual(self.client.get(f"{URL}demandes-rendu/{d['id']}/").status_code, 200)
        self.assertEqual(self.client.get(f"{URL}demandes-rendu/").data["count"], 1)

    def test_validations(self):
        self.se_connecter(self.client_a)
        autre = creer_commande(self.client_b, self.produit)
        cas = [({"description": "trop court"}, "description"), ({"type_batiment": "x"}, "type_batiment"),
               ({"commande": autre.pk}, "commande"), ({"produit": self.hors_ligne.pk}, "produit"),
               ({"images": [image_png(f"{i}.png") for i in range(6)]}, "images")]
        for plus, champ in cas:
            with self.subTest(champ=champ):
                r = self.deposer(**plus)
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn(champ, r.data)
        self.assertEqual(DemandeRendu.objects.count(), 0)

    def test_image_illisible_400_sans_fichier_restant(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.conf import settings
        from pathlib import Path
        self.se_connecter(self.client_a)
        faux = SimpleUploadedFile("x.png", b"pas une image", content_type="image/png")
        r = self.deposer(images=[image_png("ok.png"), faux])
        self.assertEqual(r.status_code, 400)
        self.assertIn("images", r.data)
        self.assertEqual(DemandeRendu.objects.count(), 0)
        self.assertEqual(list(Path(settings.MEDIA_ROOT).rglob("*.webp")), [])

    def test_quota_et_isolation(self):
        self.se_connecter(self.client_a)
        for _i in range(5):
            self.assertEqual(self.deposer().status_code, 201)
        self.assertEqual(self.deposer().status_code, 429)
        mienne = DemandeRendu.objects.first()
        self.se_connecter(self.client_b)
        self.assertEqual(self.client.get(f"{URL}demandes-rendu/{mienne.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"{URL}demandes-rendu/").data["count"], 0)

    def test_equipe_boite_de_reception(self):
        self.se_connecter(self.client_a)
        d = self.deposer().data
        self.se_connecter(self.membre)
        base = f"{URL_ADMIN}demandes-rendu/"
        self.assertEqual(self.client.get(f"{base}resume/").data,
                         {"nouvelle": 1, "en_etude": 0, "devis_envoye": 0, "close": 0, "total": 1})
        r = self.client.patch(f"{base}{d['id']}/", {"etat": "en_etude", "reponse_equipe": "Nous étudions",
                                                    "notes_internes": "Secret"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["client"]["email"], "a@exemple.cm")
        self.assertEqual(r.data["notes_internes"], "Secret")
        self.assertEqual(self.client.get(f"{base}?etat=en_etude&search=Alice").data["count"], 1)
        self.assertEqual(self.client.patch(f"{base}{d['id']}/", {"etat": "zzz"}, format="json").status_code, 400)
        self.se_connecter(self.client_a)
        vu = self.client.get(f"{URL}demandes-rendu/{d['id']}/")
        self.assertEqual(vu.data["reponse_equipe"], "Nous étudions")
        self.assertNotIn("Secret", vu.content.decode())
        self.assertEqual(self.client.get(f"{base}").status_code, 403)

    def test_produit_traduit(self):
        self.se_connecter(self.client_a)
        d = self.deposer(produit=self.produit.pk).data
        r = self.client.get(f"{URL}demandes-rendu/{d['id']}/", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.data["produit"]["nom"], "Self-levelling floor")
