"""Revue du testeur (vague 2) : calcul, envoi, droits, isolation et images des demandes de rendu."""
from decimal import Decimal
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from PIL import Image

from apps.commandes.models import Commande, EtatProposition, Proposition
from apps.commandes.tests.outils import BaseVague2, creer_commande, image_png
from apps.devis import calcul
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

    def devis(self, lignes=LIGNES, commande=None, **plus):
        self.se_connecter(self.membre)
        r = self.client.post(URL_ADMIN, {"commande": (commande or self.commande).pk, "lignes": lignes, **plus},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.data

    def envoyer(self, d):
        self.se_connecter(self.membre)
        return self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/")


class CalculRevueTests(Base):
    def test_arrondis_demi_vers_le_haut_aux_limites(self):
        D = Decimal
        self.assertEqual(calcul.arrondir(D("0.5")), 1)
        self.assertEqual(calcul.arrondir(D("1.5")), 2)
        self.assertEqual(calcul.arrondir(D("2.5")), 3)
        self.assertEqual(calcul.arrondir(D("2.4999")), 2)
        self.assertEqual(calcul.arrondir(D("5.025"), 2), D("5.03"))
        self.assertEqual(calcul.arrondir(D("5.024999"), 2), D("5.02"))
        # matériau : 10,05 m2 x 0,5 kg/m2 = 5,025 -> 5,03 kg ; 5,03 x 100 = 503
        r = calcul.calculer_ligne({"type_ligne": "materiau", "surface_m2": D("10.05"), "dosage_kg_m2": D("0.5"),
                                   "prix_kg": 100})
        self.assertEqual((r.quantite_kg, r.montant), (D("5.03"), 503))
        # le montant se calcule sur la quantité arrondie, pas sur la valeur exacte : 0,005 -> 0,01 kg x 250 = 2,5 -> 3
        r = calcul.calculer_ligne({"type_ligne": "materiau", "surface_m2": D("0.05"), "dosage_kg_m2": D("0.1"),
                                   "prix_kg": 250})
        self.assertEqual((r.quantite_kg, r.montant), (D("0.01"), 3))
        r = calcul.calculer_ligne({"type_ligne": "surface", "surface_m2": D("2.50"), "prix_m2": 1001})
        self.assertEqual(r.montant, 2503)

    def test_manques_et_zero(self):
        D = Decimal
        r = calcul.calculer_ligne({"type_ligne": "surface", "surface_m2": D("0"), "prix_m2": 100})
        self.assertIsNone(r.montant)
        self.assertEqual([c for c, _m in r.erreurs], ["surface_m2"])
        r = calcul.calculer_ligne({"type_ligne": "materiau"})
        self.assertEqual(sorted(c for c, _m in r.erreurs), ["dosage_kg_m2", "prix_kg", "surface_m2"])
        r = calcul.calculer_ligne({"type_ligne": "forfait"})
        self.assertEqual([c for c, _m in r.erreurs], ["montant_forfait"])
        self.assertFalse(calcul.calculer([]).complet)
        self.assertEqual(calcul.calculer([]).total, 0)

    def test_calculer_api(self):
        self.se_connecter(self.membre)
        lignes = [{"type_ligne": "surface", "surface_m2": "10", "prix_m2": 100},
                  {"type_ligne": "materiau", "surface_m2": "10", "dosage_kg_m2": "1.5"},  # prix manquant
                  {"type_ligne": "forfait", "montant_forfait": "2 500"}]
        r = self.client.post(f"{URL_ADMIN}calculer/", {"lignes": lignes}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.data["total"], r.data["complet"]), ("3500", False))
        self.assertEqual([(e["ligne"], e["champ"]) for e in r.data["erreurs"]], [(1, "prix_kg")])
        self.assertEqual(r.data["lignes"][1]["quantite_kg"], "15.00")
        self.assertIsNone(r.data["lignes"][1]["montant"])
        self.assertEqual(r.data["lignes"][0]["ordre"], 0)
        self.assertEqual(Devis.objects.count(), 0)  # rien d'enregistré

    def test_calculer_entrees_hostiles(self):
        self.se_connecter(self.membre)
        mauvais = [{"lignes": [{"type_ligne": "inconnu"}]}, {"lignes": [{"type_ligne": "forfait",
                                                                          "montant_forfait": -1}]},
                   {"lignes": [{"type_ligne": "surface", "surface_m2": "-1"}]},
                   {"lignes": [{"type_ligne": "surface", "surface_m2": "NaN"}]},
                   {"lignes": [{"type_ligne": "surface", "prix_m2": 1.5}]},
                   {"lignes": [{"type_ligne": "surface", "prix_m2": "abc"}]},
                   {"lignes": [{"type_ligne": "surface", "produit": 999999}]},
                   {"lignes": [{"type_ligne": "forfait"}] * 101}, {"lignes": "x"}, {}]
        for corps in mauvais:
            with self.subTest(corps=str(corps)[:60]):
                self.assertEqual(self.client.post(f"{URL_ADMIN}calculer/", corps, format="json").status_code, 400)
        r = self.client.post(f"{URL_ADMIN}calculer/", {"lignes": []}, format="json")
        self.assertEqual((r.status_code, r.data["complet"], r.data["total"]), (200, False, "0"))

    def test_calculer_reserve_a_l_equipe(self):
        for qui, code in ((self.client_a, 403), (None, 401)):
            self.client.force_authenticate(qui)
            self.assertEqual(self.client.post(f"{URL_ADMIN}calculer/", {"lignes": []}, format="json").status_code,
                             code)


class EnvoiRevueTests(Base):
    def test_envoi_refuse_devis_vide_total_nul_ou_sans_libelle(self):
        cas = {"vide": [], "total_nul": [{"type_ligne": "forfait", "libelle": "Rien", "montant_forfait": 0}],
               "sans_libelle": [{"type_ligne": "forfait", "montant_forfait": 100}],
               "prix_manquant": [{"type_ligne": "surface", "libelle": "Pose", "surface_m2": "5"}]}
        for nom, lignes in cas.items():
            with self.subTest(nom=nom):
                d = self.devis(lignes=lignes)
                r = self.envoyer(d)
                self.assertEqual(r.status_code, 400, r.content)
                self.assertEqual(Devis.objects.get(pk=d["id"]).etat, "brouillon")
        self.assertFalse(Proposition.objects.exists())
        self.commande.refresh_from_db()
        self.assertEqual(self.commande.etat, "nouvelle")

    def test_envoi_hors_negociation_annule_tout(self):
        for etat in ("contrat_signe", "travaux", "terminee", "annulee"):
            with self.subTest(etat=etat):
                c = creer_commande(self.client_b, self.produit, surface_m2="20")
                d = self.devis(commande=c)
                Commande.objects.filter(pk=c.pk).update(etat=etat)
                r = self.envoyer(d)
                self.assertEqual(r.status_code, 400, r.content)
                self.assertEqual(Devis.objects.get(pk=d["id"]).etat, "brouillon")  # transaction annulée
                self.assertFalse(Proposition.objects.filter(commande=c).exists())

    def test_envoi_cree_la_proposition_de_l_equipe(self):
        d = self.devis(notes="Valable un mois")
        self.assertEqual(self.envoyer(d).status_code, 200)
        p = Proposition.objects.get()
        self.assertEqual((p.auteur_role, p.total, p.message, p.devis_id, p.etat),
                         ("equipe", 250000, "Valable un mois", d["id"], "en_attente"))
        self.commande.refresh_from_db()
        self.assertEqual(self.commande.etat, "negociation")

    def test_envoi_remplace_la_proposition_du_client_et_le_devis_precedent(self):
        d1 = self.devis()
        self.envoyer(d1)
        self.se_connecter(self.client_a)
        self.client.post(f"{CMD}{self.commande.pk}/propositions/", {"total": 100000}, format="json")
        self.assertEqual(Devis.objects.get(pk=d1["id"]).etat, "remplace")
        d2 = self.devis()
        self.envoyer(d2)
        self.assertEqual(list(Proposition.objects.order_by("id").values_list("etat", flat=True)),
                         ["remplacee", "remplacee", "en_attente"])
        self.assertEqual(Proposition.objects.filter(etat=EtatProposition.EN_ATTENTE).count(), 1)

    def test_acceptation_marque_le_devis_et_fixe_le_montant(self):
        d = self.devis()
        self.envoyer(d)
        self.se_connecter(self.client_a)
        pid = Proposition.objects.get().pk
        r = self.client.post(f"{CMD}{self.commande.pk}/propositions/{pid}/accepter/", {}, format="json")
        self.assertEqual((r.status_code, r.data["montant_convenu"]), (200, "250000"))
        self.assertEqual(Devis.objects.get(pk=d["id"]).etat, "accepte")
        self.assertEqual(self.client.get(f"{URL}{d['id']}/").data["etat"], "accepte")

    def test_devis_modifiable_seulement_en_brouillon(self):
        d = self.devis()
        self.envoyer(d)
        for etat in ("envoye", "accepte", "refuse", "remplace"):
            Devis.objects.filter(pk=d["id"]).update(etat=etat)
            r = self.client.patch(f"{URL_ADMIN}{d['id']}/", {"notes": "x", "lignes": []}, format="json")
            self.assertEqual(r.status_code, 400, etat)
            self.assertEqual(self.client.delete(f"{URL_ADMIN}{d['id']}/").status_code, 400, etat)
            self.assertEqual(self.client.post(f"{URL_ADMIN}{d['id']}/envoyer/").status_code, 400, etat)
        self.assertEqual(Devis.objects.get(pk=d["id"]).lignes.count(), 2)
        self.assertEqual(self.client.put(f"{URL_ADMIN}{d['id']}/", {}, format="json").status_code, 405)

    def test_patch_ne_change_ni_la_commande_ni_l_etat(self):
        d = self.devis()
        autre = creer_commande(self.client_b, self.produit)
        self.client.patch(f"{URL_ADMIN}{d['id']}/", {"commande": autre.pk, "etat": "accepte", "reference": "X-1",
                                                     "envoye_le": "2026-01-01T00:00:00Z"}, format="json")
        devis = Devis.objects.get(pk=d["id"])
        self.assertEqual((devis.commande_id, devis.etat, devis.envoye_le), (self.commande.pk, "brouillon", None))
        self.assertTrue(devis.reference.startswith("DEV-"))

    def test_validations_creation(self):
        self.se_connecter(self.membre)
        mauvais = [{"lignes": LIGNES}, {"commande": 999999, "lignes": LIGNES},
                   {"commande": self.commande.pk, "validite_jours": 0},
                   {"commande": self.commande.pk, "validite_jours": 366},
                   {"commande": self.commande.pk, "notes": "x" * 1001},
                   {"commande": self.commande.pk, "demande": 999999}]
        for corps in mauvais:
            with self.subTest(corps=str(corps)[:60]):
                self.assertEqual(self.client.post(URL_ADMIN, corps, format="json").status_code, 400)
        self.assertEqual(Devis.objects.count(), 0)

    def test_depassement_de_capacite_du_total_refuse(self):
        """100 forfaits de 1 milliard : total de 100 milliards, au-delà d'un entier 32 bits (500 sous PostgreSQL)."""
        lignes = [{"type_ligne": "forfait", "libelle": f"F{i}", "montant_forfait": 1_000_000_000} for i in range(10)]
        d = self.devis(lignes=lignes)
        r = self.envoyer(d)
        self.assertEqual(r.status_code, 400, r.content)

    def test_client_ne_voit_ni_brouillons_ni_devis_d_autrui_et_ne_modifie_rien(self):
        brouillon = self.devis()
        envoye = self.devis()
        self.envoyer(envoye)
        self.se_connecter(self.client_a)
        self.assertEqual([x["id"] for x in self.client.get(URL).data["results"]], [envoye["id"]])
        for methode in ("post", "patch", "put", "delete"):
            r = getattr(self.client, methode)(f"{URL}{envoye['id']}/", {"notes": "x"}, format="json")
            self.assertEqual(r.status_code, 405, methode)
        detail = self.client.get(f"{URL}{envoye['id']}/").data
        self.assertNotIn("cree_par", detail)
        self.assertNotIn("demande", detail)
        self.assertEqual(set(detail["lignes"][0]), {"ordre", "type_ligne", "libelle", "surface_m2", "dosage_kg_m2",
                                                    "quantite_kg", "prix_kg", "prix_m2", "montant"})
        self.se_connecter(self.client_b)
        self.assertEqual(self.client.get(f"{URL}{envoye['id']}/").status_code, 404)
        self.assertEqual(self.client.get(f"{CMD}{self.commande.pk}/").status_code, 404)
        self.assertNotIn(brouillon["reference"], self.client.get(URL).content.decode())

    def test_requetes_constantes_listes_equipe(self):
        def mesurer(url):
            self.se_connecter(self.membre)
            with CaptureQueriesContext(connection) as ctx:
                self.assertEqual(self.client.get(url).status_code, 200)
            return len(ctx)

        d0 = self.devis()
        DemandeRendu.objects.create(client=self.client_a, description=DESC, type_batiment="maison",
                                    produit=self.produit)
        avant = (mesurer(URL_ADMIN), mesurer(f"{URL_ADMIN}demandes-rendu/"), mesurer(f"{URL_ADMIN}{d0['id']}/"))
        for _i in range(8):
            self.devis(lignes=LIGNES + [{"type_ligne": "surface", "produit": self.produit.pk, "surface_m2": "2",
                                         "prix_m2": 10}])
            DemandeRendu.objects.create(client=self.client_b, description=DESC, type_batiment="maison",
                                        produit=self.autre_produit)
        self.assertEqual((mesurer(URL_ADMIN), mesurer(f"{URL_ADMIN}demandes-rendu/")), avant[:2])


class DemandesRenduRevueTests(Base):
    def deposer(self, **plus):
        return self.client.post(f"{URL}demandes-rendu/", {"description": DESC, "type_batiment": "maison", **plus},
                                format="multipart")

    def test_images_cinq_au_plus_et_types_refuses(self):
        self.se_connecter(self.client_a)
        r = self.deposer(images=[image_png(f"{i}.png") for i in range(5)])
        self.assertEqual((r.status_code, len(r.data["images"])), (201, 5), r.content)
        # corps non image sous un nom et un type d'image
        faux = [SimpleUploadedFile("a.png", b"<?php echo 1; ?>", content_type="image/png"),
                SimpleUploadedFile("a.jpg", b"<html><script>alert(1)</script></html>", content_type="image/jpeg"),
                SimpleUploadedFile("a.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
                                   content_type="image/svg+xml"),
                SimpleUploadedFile("a.pdf", b"%PDF-1.4 1 0 obj", content_type="application/pdf"),
                SimpleUploadedFile("vide.png", b"", content_type="image/png")]
        for fichier in faux:
            with self.subTest(fichier=fichier.name):
                r = self.deposer(images=[fichier])
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn("images", r.data)
        self.assertEqual(DemandeRendu.objects.count(), 1)

    def test_image_trop_lourde_ou_trop_grande(self):
        self.se_connecter(self.client_a)
        tampon = BytesIO()
        Image.new("L", (9000, 6000), 0).save(tampon, "PNG")  # 54 mégapixels, quelques ko
        enorme = SimpleUploadedFile("g.png", tampon.getvalue(), content_type="image/png")
        r = self.deposer(images=[enorme])
        self.assertEqual(r.status_code, 400, r.content)
        lourde = SimpleUploadedFile("l.png", b"\x89PNG\r\n\x1a\n" + b"0" * (11 * 1024 * 1024), content_type="image/png")
        self.assertEqual(self.deposer(images=[lourde]).status_code, 400)
        self.assertEqual(DemandeRendu.objects.count(), 0)

    def test_image_stockee_en_webp_et_nom_non_controle_par_le_client(self):
        self.se_connecter(self.client_a)
        r = self.deposer(images=[image_png("../../etc/passwd.png")])
        self.assertEqual(r.status_code, 201, r.content)
        url = r.data["images"][0]["url"]
        self.assertTrue(url.endswith(".webp"))
        self.assertNotIn("..", url)

    def test_validations(self):
        self.se_connecter(self.client_a)
        cas = [{"description": "court"}, {"description": "x" * 19}, {"description": "x" * 1501},
               {"type_batiment": "piscine"}, {"surface_m2": "0"}, {"surface_m2": "-5"}, {"surface_m2": "abc"},
               {"produit": self.hors_ligne.pk}, {"produit": 999999}, {"commande": 999999}]
        for plus in cas:
            with self.subTest(plus=str(plus)):
                self.assertEqual(self.deposer(**plus).status_code, 400)
        b = creer_commande(self.client_b, self.produit)
        self.assertEqual(self.deposer(commande=b.pk).status_code, 400)  # commande d'un autre : refusée
        self.assertEqual(DemandeRendu.objects.count(), 0)
        self.assertEqual(self.deposer(description="x" * 20).status_code, 201)
        self.assertEqual(self.deposer(description=" " * 10 + "x" * 10).status_code, 400)  # espaces non comptés

    def test_quota_de_cinq_par_jour_et_par_compte(self):
        self.se_connecter(self.client_a)
        for _i in range(5):
            self.assertEqual(self.deposer().status_code, 201)
        self.assertEqual(self.deposer().status_code, 429)
        self.se_connecter(self.client_b)
        self.assertEqual(self.deposer().status_code, 201)

    def test_acces(self):
        d = DemandeRendu.objects.create(client=self.client_a, description=DESC, type_batiment="maison")
        for chemin, methode in ((f"{URL}demandes-rendu/", "get"), (f"{URL}demandes-rendu/", "post"),
                                (f"{URL}demandes-rendu/{d.pk}/", "get")):
            self.client.force_authenticate(None)
            self.assertEqual(getattr(self.client, methode)(chemin).status_code, 401)
            self.se_connecter(self.membre)
            r = getattr(self.client, methode)(chemin)
            self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))
        self.se_connecter(self.client_b)
        self.assertEqual(self.client.get(f"{URL}demandes-rendu/{d.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"{URL}demandes-rendu/").data["count"], 0)
        self.se_connecter(self.client_a)
        for methode in ("patch", "put", "delete"):
            self.assertEqual(getattr(self.client, methode)(f"{URL}demandes-rendu/{d.pk}/", {},
                                                           format="json").status_code, 405)

    def test_notes_internes_et_brouillons_jamais_cote_client(self):
        d = DemandeRendu.objects.create(client=self.client_a, description=DESC, type_batiment="maison",
                                        notes_internes="SECRET-INTERNE")
        brouillon = self.devis()
        Devis.objects.filter(pk=brouillon["id"]).update(demande=d)
        self.se_connecter(self.client_a)
        for chemin in (f"{URL}demandes-rendu/", f"{URL}demandes-rendu/{d.pk}/"):
            corps = self.client.get(chemin).content.decode()
            self.assertNotIn("SECRET-INTERNE", corps)
            self.assertNotIn(brouillon["reference"], corps)
        self.se_connecter(self.membre)
        r = self.client.get(f"{URL_ADMIN}demandes-rendu/{d.pk}/")
        self.assertEqual(r.data["notes_internes"], "SECRET-INTERNE")
        self.assertIn(brouillon["reference"], r.content.decode())

    def test_equipe_met_a_jour_et_resume(self):
        d = DemandeRendu.objects.create(client=self.client_a, description=DESC, type_batiment="maison")
        self.se_connecter(self.membre)
        for corps in ({"etat": "inconnu"}, {"etat": None}):
            self.assertEqual(self.client.patch(f"{URL_ADMIN}demandes-rendu/{d.pk}/", corps, format="json").status_code,
                             400)
        r = self.client.patch(f"{URL_ADMIN}demandes-rendu/{d.pk}/",
                              {"etat": "en_etude", "reponse_equipe": " Bien reçu ", "client": self.client_b.pk,
                               "description": "piraté"}, format="json")
        self.assertEqual((r.status_code, r.data["etat"], r.data["reponse_equipe"]), (200, "en_etude", "Bien reçu"))
        d.refresh_from_db()
        self.assertEqual((d.client_id, d.description), (self.client_a.pk, DESC))
        resume = self.client.get(f"{URL_ADMIN}demandes-rendu/resume/").data
        self.assertEqual((resume["en_etude"], resume["total"]), (1, 1))
        for qui, code in ((self.client_a, 403), (None, 401)):
            self.client.force_authenticate(qui)
            self.assertEqual(self.client.get(f"{URL_ADMIN}demandes-rendu/").status_code, code)
            self.assertEqual(self.client.patch(f"{URL_ADMIN}demandes-rendu/{d.pk}/", {}, format="json").status_code,
                             code)
