"""Services des commandes : droit de commander, création, quotas, références, modifications."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError

from apps.catalogue.models import Design
from apps.commandes import services
from apps.commandes.models import Commande
from apps.commandes.tests.outils import BaseVague2, creer_client_sans_adresse, creer_commande
from apps.noyau.models import CompteurReference
from apps.noyau.references import prochaine_reference
from apps.selection import services as selection


class CreationTests(BaseVague2, TestCase):
    def donnees(self, **plus):
        return {"type_batiment": "maison", "lignes": [{"produit": self.produit.pk, "design": self.design.pk}], **plus}

    def test_creation_copie_l_adresse_et_les_noms(self):
        commande = services.creer_commande(self.client_a, self.donnees(surface_m2=Decimal("20"), description=" Salon "))
        self.assertEqual((commande.ville, commande.quartier, commande.rue_ou_repere),
                         ("Douala", "Bonapriso", "Près de la pharmacie"))
        self.assertEqual(commande.etat, "nouvelle")
        self.assertEqual(commande.description, "Salon")
        ligne = commande.lignes.get()
        self.assertEqual((ligne.produit_nom, ligne.produit_reference, ligne.design_nom),
                         ("Sol autolissant", "YD-500", "Gris"))
        # instantané : une modification du profil ensuite ne change pas le chantier
        self.client_a.quartier = "Akwa"
        self.client_a.save()
        commande.refresh_from_db()
        self.assertEqual(commande.quartier, "Bonapriso")

    def test_adresse_incomplete(self):
        client = creer_client_sans_adresse()
        with self.assertRaises(PermissionDenied) as c:
            services.creer_commande(client, self.donnees())
        self.assertEqual(c.exception.detail["code"], "adresse_incomplete")
        self.assertEqual(Commande.objects.count(), 0)

    def test_compte_equipe_et_compte_inactif(self):
        with self.assertRaises(PermissionDenied) as c:
            services.creer_commande(self.membre, self.donnees())
        self.assertEqual(c.exception.detail["code"], "compte_equipe")
        self.client_a.is_active = False
        with self.assertRaises(PermissionDenied):
            services.creer_commande(self.client_a, self.donnees())

    def test_lignes_refusees(self):
        autre_design = Design.objects.create(produit=self.autre_produit, nom="Bleu")
        cas = [{"lignes": []}, {"lignes": [{"produit": self.hors_ligne.pk}]}, {"lignes": [{"produit": 0}]},
               {"lignes": [{"produit": self.produit.pk, "design": autre_design.pk}]},
               {"lignes": [{"produit": self.produit.pk}], "surface_m2": Decimal("0")},
               {"lignes": [{"produit": self.produit.pk}], "description": "x" * 1501}]
        for plus in cas:
            with self.subTest(plus=plus), self.assertRaises(ValidationError):
                services.creer_commande(self.client_a, self.donnees(**plus))
        self.assertEqual(Commande.objects.count(), 0)

    def test_depuis_selection_vide_la_selection(self):
        selection.ajouter(self.client_a, self.produit.pk, self.design.pk)
        selection.ajouter(self.client_a, self.autre_produit.pk)
        commande = services.creer_commande(self.client_a, {"type_batiment": "industrie", "depuis_selection": True})
        self.assertEqual(commande.lignes.count(), 2)
        self.assertEqual(selection.ids_produits(self.client_a), [])

    def test_depuis_selection_vide_refuse_et_conserve_la_selection(self):
        selection.ajouter(self.client_a, self.produit.pk)
        self.produit.en_ligne = False
        self.produit.save()
        with self.assertRaises(ValidationError):
            services.creer_commande(self.client_a, {"type_batiment": "maison", "depuis_selection": True})
        self.assertEqual(selection.ids_produits(self.client_a), [self.produit.pk])
        with self.assertRaises(ValidationError):
            services.creer_commande(self.client_b, {"type_batiment": "maison", "depuis_selection": True})

    def test_quota_de_cinq_par_jour_et_par_compte(self):
        for _i in range(5):
            creer_commande(self.client_a, self.produit)
        with self.assertRaises(Throttled):
            creer_commande(self.client_a, self.produit)
        creer_commande(self.client_b, self.produit)  # un autre compte n'est pas touché


class ReferencesTests(BaseVague2, TestCase):
    def test_references_sequentielles_par_annee(self):
        self.assertEqual(prochaine_reference("CIR", 2026), "CIR-2026-0001")
        self.assertEqual(prochaine_reference("CIR", 2026), "CIR-2026-0002")
        self.assertEqual(prochaine_reference("CIR", 2027), "CIR-2027-0001")
        self.assertEqual(prochaine_reference("DEV", 2026), "DEV-2026-0001")
        self.assertEqual(CompteurReference.objects.count(), 3)

    def test_commandes_recoivent_des_references_distinctes(self):
        refs = [creer_commande(self.client_a, self.produit).reference for _i in range(3)]
        annee = refs[0].split("-")[1]
        self.assertEqual(refs, [f"CIR-{annee}-000{i}" for i in (1, 2, 3)])

    def test_reference_stable_a_la_modification(self):
        commande = creer_commande(self.client_a, self.produit)
        ref = commande.reference
        commande.description = "Modifiée"
        commande.save()
        self.assertEqual(Commande.objects.get(pk=commande.pk).reference, ref)
        self.assertEqual(CompteurReference.objects.get().dernier, 1)


class ModificationTests(BaseVague2, TestCase):
    def test_client_modifie_en_nouvelle_seulement(self):
        commande = creer_commande(self.client_a, self.produit)
        services.modifier_par_client(commande, {"surface_m2": Decimal("30"), "description": "Garage"})
        commande.refresh_from_db()
        self.assertEqual((commande.surface_m2, commande.description), (Decimal("30.00"), "Garage"))
        services.proposer(commande, self.membre, "equipe", {"total": 1000})
        commande.refresh_from_db()
        with self.assertRaises(ValidationError):
            services.modifier_par_client(commande, {"surface_m2": Decimal("31")})

    def test_equipe_surface_jusqu_au_contrat_notes_toujours(self):
        commande = creer_commande(self.client_a, self.produit, surface_m2=Decimal("10"))
        p = services.proposer(commande, self.membre, "equipe", {"total": 5000})
        services.modifier_par_equipe(commande, {"surface_m2": Decimal("12"), "notes_internes": "Client pressé"})
        services.repondre(p, self.client_a, "client", True)
        commande.refresh_from_db()
        with self.assertRaises(ValidationError):
            services.modifier_par_equipe(commande, {"surface_m2": Decimal("13")})
        services.modifier_par_equipe(commande, {"notes_internes": "Contrat signé"})
        commande.refresh_from_db()
        self.assertEqual((commande.surface_m2, commande.notes_internes), (Decimal("12.00"), "Contrat signé"))
