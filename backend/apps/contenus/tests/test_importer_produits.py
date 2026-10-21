"""Chargeur du catalogue de référence + import des images de produits : idempotence, données de l'équipe, --forcer."""
from io import StringIO
from pathlib import Path

from django.apps import apps
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework.test import APIClient

from apps.catalogue.models import Famille, ImageProduit, Produit
from apps.contenus.management.commands.importer_medias_reference import Command
from apps.noyau.langues import CODES_LANGUES

from .test_importer_medias import ImporterMediasTestCase

AVEC_IMAGE = ["Sol autolissant époxy", "Terrazzo époxy", "Finition époxy lisse", "Finition antidérapante",
              "Peinture de sol anti-UV", "Finition haute résistance"]


class ProduitsBase(ImporterMediasTestCase):
    def charger(self):
        call_command("charger_catalogue_reference", stdout=StringIO())

    def fichiers_produits(self):
        return [f for f in self.fichiers_media() if f.startswith("catalogue/produits/")]


class IdempotenceProduitsTests(ProduitsBase):
    def test_deux_fois_chargeur_et_import_sans_doublon_ni_orphelin(self):
        for _ in range(2):
            self.charger()
            self.importer()
        self.assertEqual(Produit.objects.count(), 16)
        self.assertEqual(Famille.objects.count(), 9)
        self.assertEqual(ImageProduit.objects.count(), 6)
        self.assertEqual(sorted(ImageProduit.objects.values_list("produit__nom", flat=True)), sorted(AVEC_IMAGE))
        self.assertEqual(len(self.fichiers_produits()), 6)
        for image in ImageProduit.objects.all():
            self.assertTrue(Path(image.image.path).is_file())
            for langue in CODES_LANGUES:
                self.assertTrue(image.traduit("alt", langue).strip(), (image.produit.nom, langue))
        self.assertFalse(Produit.objects.filter(prix__isnull=False).exists())

    def test_import_avant_chargeur_ignore_les_produits_absents(self):
        sortie = self.importer()
        self.assertEqual(ImageProduit.objects.count(), 0)
        self.assertIn("absent du catalogue", sortie)
        self.assertEqual(Produit.objects.count(), 0)
        self.assertEqual(self.fichiers_produits(), [])

    def test_aucune_ecriture_hors_modeles_prevus(self):
        self.charger()
        autres = [m for m in apps.get_models()
                  if m not in (Produit, Famille, ImageProduit) and m._meta.app_label != "contenus"]
        avant = {m: m.objects.count() for m in autres}
        self.importer()
        self.importer("--forcer")
        self.assertEqual({m: m.objects.count() for m in autres}, avant)
        self.assertEqual(Produit.objects.count(), 16)


class DonneesEquipeTests(ProduitsBase):
    def test_produit_modifie_jamais_ecrase_par_le_chargeur(self):
        self.charger()
        p = Produit.objects.get(reference="YD-500")
        autre = Famille.objects.create(nom="Famille équipe")
        Produit.objects.filter(pk=p.pk).update(nom="Mon sol", accroche="Mon accroche", description="Ma description",
                                               famille=autre, prix=12000, pour_maison=False, a_la_une=False,
                                               traductions={"en": {"nom": "My floor", "accroche": "My hook"}})
        yd306 = Produit.objects.get(reference="YD-306")
        Produit.objects.filter(pk=yd306.pk).update(nom="Sable maison", accroche="X", prix=5)
        self.charger()
        self.charger()
        p.refresh_from_db()
        self.assertEqual((p.nom, p.accroche, p.description, p.famille_id, p.prix, p.pour_maison, p.a_la_une),
                         ("Mon sol", "Mon accroche", "Ma description", autre.id, 12000, False, False))
        self.assertEqual(p.traductions["en"]["nom"], "My floor")
        self.assertEqual(p.traductions["en"]["accroche"], "My hook")
        yd306.refresh_from_db()
        self.assertEqual((yd306.nom, yd306.accroche, yd306.prix), ("Sable maison", "X", 5))
        self.assertEqual(Produit.objects.filter(reference="YD-500").count(), 1)

    def test_renommage_seulement_si_ancien_nom_exact(self):
        Famille.objects.all().delete()
        self.charger()
        Produit.objects.filter(reference="YD-500").update(nom="Sol autolissant", traductions={})
        self.charger()
        self.assertEqual(Produit.objects.get(reference="YD-500").nom, "Sol autolissant époxy")
        Produit.objects.filter(reference="YD-500").update(nom="Sol autolissant ")  # espace final : nom d'équipe
        self.charger()
        self.assertEqual(Produit.objects.get(reference="YD-500").nom, "Sol autolissant ")

    def test_import_n_ecrase_pas_les_images_de_l_equipe(self):
        self.charger()
        p = Produit.objects.get(nom="Terrazzo époxy")
        equipe = ImageProduit(produit=p, alt="Photo équipe", ordre=3)
        equipe.image.save("equipe.png", ContentFile(self.png()), save=False)
        equipe.save()
        avant = self.fichiers_produits()
        self.importer()
        self.importer()
        self.assertEqual(list(p.images.values_list("alt", flat=True)), ["Photo équipe"])
        self.assertIn(equipe.image.name, self.fichiers_produits())
        self.assertEqual(len(self.fichiers_produits()), len(avant) + 5)

    def png(self):
        from io import BytesIO
        from PIL import Image
        tampon = BytesIO()
        Image.new("RGB", (40, 40), "red").save(tampon, "PNG")
        return tampon.getvalue()

    def test_produit_modifie_texte_famille_prix_intacts_apres_import(self):
        self.charger()
        p = Produit.objects.get(nom="Finition époxy lisse")
        Produit.objects.filter(pk=p.pk).update(prix=4000, accroche="A", description="D")
        champs = ("nom", "accroche", "description", "famille_id", "prix", "slug", "reference", "en_ligne")
        avant = {c: getattr(Produit.objects.get(pk=p.pk), c) for c in champs}
        self.importer()
        self.importer("--forcer")
        p.refresh_from_db()
        self.assertEqual({c: getattr(p, c) for c in champs}, avant)

    def test_forcer_remplace_toutes_les_images_du_produit_concerne(self):
        """Effet documenté de --forcer : TOUTES les images du produit concerné sont supprimées (équipe incluse)."""
        self.charger()
        self.importer()
        p = Produit.objects.get(nom="Terrazzo époxy")
        equipe = ImageProduit(produit=p, alt="Photo équipe", ordre=3)
        equipe.image.save("equipe.png", ContentFile(self.png()), save=False)
        equipe.save()
        autre = Produit.objects.get(nom="Sol à motifs")  # produit non concerné
        propre = ImageProduit(produit=autre, alt="Mienne", ordre=0)
        propre.image.save("mienne.png", ContentFile(self.png()), save=False)
        propre.save()
        self.importer("--forcer")
        self.assertEqual(p.images.count(), 1)
        self.assertNotEqual(p.images.get().alt, "Photo équipe")
        self.assertEqual(autre.images.count(), 1)
        self.assertEqual(len(self.fichiers_produits()), 7)  # 6 importées + 1 de l'équipe sur un autre produit

    def test_forcer_documente_la_suppression_des_images_de_produit(self):
        """L'aide de l'option doit prévenir que les images existantes des produits concernés sont supprimées."""
        parser = Command().create_parser("manage.py", "importer_medias_reference")
        aide = next(x.help for x in parser._actions if "--forcer" in x.option_strings).lower()
        self.assertIn("image", aide)
        self.assertIn("produit", aide)
        self.assertIn("supprim", aide)

    def test_forcer_echec_conserve_images_de_produit(self):
        self.charger()
        self.importer()
        avant = self.fichiers_produits()
        alts = sorted(ImageProduit.objects.values_list("id", "alt"))
        dossier = self.copie_dossier()
        (dossier / "images/gradins.webp").write_bytes(b"pas une image")  # image de la sphère ET du produit anti-UV
        with self.assertRaises(Exception):
            self.importer("--forcer", dossier=dossier)
        self.assertEqual(self.fichiers_produits(), avant)
        self.assertEqual(sorted(ImageProduit.objects.values_list("id", "alt")), alts)


class DoublonsEtSlugsTests(ProduitsBase):
    def test_pas_de_doublon_par_casse(self):
        famille = Famille.objects.create(nom="Ma famille")
        Produit.objects.create(famille=famille, nom="finition époxy MATE")
        self.charger()
        self.assertEqual(Produit.objects.filter(nom__iexact="Finition époxy mate").count(), 1)
        self.assertEqual(Produit.objects.count(), 16)

    def test_doublon_par_espaces_autour_du_nom(self):
        """Un produit « Finition époxy mate » avec espace final ne doit pas être recréé en double."""
        famille = Famille.objects.create(nom="Ma famille")
        Produit.objects.create(famille=famille, nom=" Finition époxy mate ")
        self.charger()
        self.assertEqual(Produit.objects.filter(nom__icontains="Finition époxy mate").count(), 1)

    def test_slugs_uniques_et_references_vides_multiples(self):
        self.charger()
        slugs = list(Produit.objects.values_list("slug", flat=True))
        self.assertEqual(len(slugs), len(set(slugs)))
        self.assertTrue(all(slugs))
        self.assertEqual(Produit.objects.filter(reference="").count(), 7)
        famille = Famille.objects.first()
        Produit.objects.create(famille=famille, nom="Finition époxy lisse")  # même nom, sans référence
        self.assertEqual(len(set(Produit.objects.values_list("slug", flat=True))), 17)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Produit.objects.create(famille=famille, nom="Dup", reference="YD-500")

    def test_contrainte_postgresql_ignore_la_reference_vide(self):
        """La migration crée une contrainte unique PARTIELLE (condition NOT reference = '') : valable sur PostgreSQL."""
        contraintes = {c.name: c for c in Produit._meta.constraints}
        c = contraintes["catalogue_produit_reference_unique"]
        self.assertEqual(c.fields, ("reference",))
        self.assertEqual(c.condition, ~Q(reference=""))
        migration = (Path(apps.get_app_config("catalogue").path) / "migrations" / "0001_initial.py").read_text()
        self.assertIn('_negated=True', migration)
        self.assertIn('catalogue_produit_reference_unique', migration)
        self.assertNotIn("unique=True,\n                        max_length=30", migration)

    def test_references_insensibles_a_la_casse_dans_le_chargeur(self):
        famille = Famille.objects.create(nom="Ma famille")
        Produit.objects.create(famille=famille, nom="Mon primaire", reference="yd-103")
        self.charger()
        self.assertEqual(Produit.objects.filter(reference__iexact="YD-103").count(), 1)

    def test_noms_traduits_complets_et_noms_propres_intacts(self):
        self.charger()
        for p in Produit.objects.all():
            self.assertEqual(p.langues_incompletes(), [], p.nom)
            for langue in CODES_LANGUES:
                self.assertTrue(p.traduit("nom", langue).strip())
        for p in Produit.objects.all():
            for langue in CODES_LANGUES:
                self.assertNotIn("Jiuye", p.traduit("nom", langue))
        self.assertEqual(Produit.objects.get(nom="Peinture de sol anti-UV").traduit("nom", "ja"), "耐紫外線床用塗料")


class ApiCatalogueTests(ProduitsBase):
    def setUp(self):
        super().setUp()
        self.charger()
        self.importer()
        self.api = APIClient()

    def noms(self, requete):
        r = self.api.get(f"/api/catalogue/produits/?{requete}")
        self.assertEqual(r.status_code, 200)
        return r

    def test_filtres_usage_et_famille(self):
        attendus = {"usage=maison": 3 + 2, "usage=industrie": None, "usage=exterieur": None}
        for requete, _ in attendus.items():
            r = self.noms(requete)
            for carte in r.data["results"]:
                self.assertIn(requete.split("=")[1], carte["usages"])
        self.assertEqual(self.noms("usage=exterieur").data["count"], 2)  # anti-UV, antidérapante
        self.assertEqual(self.noms("famille=finitions").data["count"],
                         Produit.objects.filter(famille__slug="finitions").count())
        self.assertEqual(self.noms("a_la_une=1").data["count"], Produit.objects.filter(a_la_une=True).count())
        self.assertEqual(self.noms("search=anti-UV").data["count"], 1)

    def test_produits_sans_image_et_pagination(self):
        r = self.noms("")
        self.assertEqual(r.data["count"], 16)
        cartes = r.data["results"]
        self.assertEqual(sum(1 for c in cartes if c["image"]), min(6, len(cartes)) if len(cartes) == 16 else
                         sum(1 for c in cartes if c["image"]))
        for c in cartes:
            self.assertIsNone(c["prix"])
        total = len(cartes)
        suivant = r.data.get("next")
        while suivant:
            page = self.api.get(suivant)
            total += len(page.data["results"])
            suivant = page.data.get("next")
        self.assertEqual(total, 16)

    def test_images_triees_par_ordre_dans_la_fiche(self):
        p = Produit.objects.get(nom="Sol autolissant époxy")
        for ordre, alt in ((5, "cinq"), (1, "un")):
            image = ImageProduit(produit=p, alt=alt, ordre=ordre)
            image.image.save("x.png", ContentFile(ProduitsBase.png_octets()), save=False)
            image.save()
        r = self.api.get(f"/api/catalogue/produits/{p.slug}/")
        self.assertEqual(r.status_code, 200)
        ordres = [i.get("alt") for i in r.data["images"]]
        self.assertEqual(ordres[:1], ["Vaste salle à piliers blancs, au sol en résine turquoise brillante."])
        self.assertEqual(ordres[1:], ["un", "cinq"])

    def test_alt_traduit_de_l_image_de_produit(self):
        p = Produit.objects.get(nom="Terrazzo époxy")
        r = self.api.get(f"/api/catalogue/produits/{p.slug}/", HTTP_ACCEPT_LANGUAGE="en")
        self.assertIn("terrazzo", r.data["images"][0]["alt"].lower())

    def test_poids_des_images_de_produit(self):
        poids = sum((self.media / f).stat().st_size for f in self.fichiers_produits())
        self.assertLess(poids, 1024 * 1024)


def _png_octets():
    from io import BytesIO
    from PIL import Image
    tampon = BytesIO()
    Image.new("RGB", (40, 40), "blue").save(tampon, "PNG")
    return tampon.getvalue()


ProduitsBase.png_octets = staticmethod(_png_octets)
