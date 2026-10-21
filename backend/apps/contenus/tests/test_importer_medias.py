"""Commande importer_medias_reference : idempotence, --forcer, fichier manquant, accueil intact, alt en 5 langues."""
import json
import shutil
import tempfile
from io import StringIO
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from PIL import Image

from apps.contenus.management.commands.importer_medias_reference import dossier_par_defaut
from apps.contenus.models import ContenuAccueil, PhotoSphere
from apps.noyau.langues import CODES_LANGUES

DOSSIER = Path(settings.BASE_DIR) / "medias_reference"
NON_IMPORTEES = {"hall-femme", "hall-marbre"}
SPHERE = ["salon-pose", "ecole-terrazzo", "entrepot-bleu-jaune", "entrepot-stockage", "parking-vert",
          "hall-turquoise", "gradins", "salon-bidons", "atelier-pose"]


class ImporterMediasTestCase(TestCase):
    def setUp(self):
        racine = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, racine, ignore_errors=True)
        self.media = Path(racine) / "media"
        reglage = override_settings(MEDIA_ROOT=str(self.media))
        reglage.enable()
        self.addCleanup(reglage.disable)

    def importer(self, *options, dossier=None):
        sortie = StringIO()
        call_command("importer_medias_reference", *options, *(["--dossier", str(dossier)] if dossier else []),
                     stdout=sortie)
        return sortie.getvalue()

    def fichiers_media(self):
        return sorted(p.relative_to(self.media).as_posix() for p in self.media.rglob("*") if p.is_file())

    def copie_dossier(self):
        copie = Path(tempfile.mkdtemp()) / "medias"
        self.addCleanup(shutil.rmtree, copie.parent, ignore_errors=True)
        shutil.copytree(DOSSIER, copie)
        return copie


class ManifesteTests(TestCase):
    def test_neuf_photos_avec_alt_dans_les_cinq_langues(self):
        manifeste = json.loads((DOSSIER / "medias.json").read_text(encoding="utf-8"))
        sphere = [e for e in manifeste["fichiers"] if e["usage"] == "sphere"]
        self.assertEqual([Path(e["fichier"]).stem for e in sorted(sphere, key=lambda e: e["ordre"])], SPHERE)
        for entree in manifeste["fichiers"]:
            self.assertTrue((DOSSIER / entree["fichier"]).is_file(), entree["fichier"])
            if "alt" in entree:
                self.assertEqual(set(entree["alt"]), set(CODES_LANGUES))
                self.assertTrue(all(t.strip() for t in entree["alt"].values()))
        self.assertTrue(NON_IMPORTEES.isdisjoint(Path(e["fichier"]).stem for e in sphere))

    def test_dossier_par_defaut(self):
        self.assertEqual(dossier_par_defaut(), DOSSIER)


class ImportTests(ImporterMediasTestCase):
    def test_premiere_execution(self):
        sortie = self.importer()
        self.assertIn("9 photo(s)", sortie)
        photos = list(PhotoSphere.objects.all())
        self.assertEqual(len(photos), 9)
        for photo, nom in zip(photos, SPHERE):
            self.assertRegex(photo.image.name, rf"^contenus/sphere/{nom}(_\w{{7}})?\.webp$")
            self.assertIsNone(photo.produit)
            self.assertTrue(photo.alt)
            for langue in CODES_LANGUES:
                self.assertTrue(photo.traduit("alt", langue).strip(), (nom, langue))
            self.assertNotEqual(photo.traduit("alt", "en"), photo.alt)
            with Image.open(photo.image.path) as image:  # passé par le modèle : WebP léger
                self.assertEqual(image.format, "WEBP")
                self.assertLessEqual(image.width, 480)
        self.assertEqual([p.ordre for p in photos], sorted(p.ordre for p in photos))
        contenu = ContenuAccueil.charger()
        self.assertRegex(contenu.video_fond.name, r"^contenus/fond(_\w{7})?\.mp4$")
        self.assertRegex(contenu.image_affiche.name, r"^contenus/affiche-1280(_\w{7})?\.webp$")
        self.assertEqual(Path(contenu.video_fond.path).read_bytes(), (DOSSIER / "video/fond.mp4").read_bytes())
        with Image.open(contenu.image_affiche.path) as image:
            self.assertEqual(image.format, "WEBP")

    def test_hall_femme_et_hall_marbre_absents(self):
        self.importer()
        noms = " ".join(self.fichiers_media())
        for nom in NON_IMPORTEES | {"affiche-768"}:
            self.assertNotIn(nom, noms)

    def test_seconde_execution_sans_doublon(self):
        self.importer()
        avant = self.fichiers_media()
        ids = list(PhotoSphere.objects.values_list("id", "image"))
        contenu = ContenuAccueil.charger()
        sortie = self.importer()
        self.assertIn("0 créée(s)", sortie.replace("photo(s) de la sphère ", ""))
        self.assertIn("9 déjà présente(s)", sortie)
        self.assertEqual(self.fichiers_media(), avant)
        self.assertEqual(list(PhotoSphere.objects.values_list("id", "image")), ids)
        self.assertEqual(ContenuAccueil.charger().video_fond.name, contenu.video_fond.name)

    def test_ne_remplace_ni_accueil_rempli_ni_alt_modifie(self):
        self.importer()
        photo = PhotoSphere.objects.first()
        photo.alt = "Texte de l'équipe"
        photo.save()
        contenu = ContenuAccueil.charger()
        contenu.video_fond.name = "contenus/autre.mp4"
        contenu.save()
        self.importer()
        self.assertEqual(PhotoSphere.objects.count(), 9)
        self.assertEqual(PhotoSphere.objects.get(pk=photo.pk).alt, "Texte de l'équipe")
        self.assertEqual(ContenuAccueil.charger().video_fond.name, "contenus/autre.mp4")

    def test_completer_un_accueil_partiel(self):
        contenu = ContenuAccueil.charger()
        contenu.video_fond.name = "contenus/autre.mp4"
        contenu.save()
        self.importer()
        contenu = ContenuAccueil.charger()
        self.assertEqual(contenu.video_fond.name, "contenus/autre.mp4")
        self.assertTrue(contenu.image_affiche)

    def test_forcer_remplace_sans_doublon(self):
        self.importer()
        avant_photos = set(PhotoSphere.objects.values_list("id", flat=True))
        photo = PhotoSphere.objects.first()
        photo.alt = "Texte modifié"
        photo.traductions = {"en": {"alt": "Changed"}}
        photo.save()
        contenu = ContenuAccueil.charger()
        ancienne_video = contenu.video_fond.path
        sortie = self.importer("--forcer")
        self.assertIn("9 remplacée(s)", sortie)
        self.assertEqual(set(PhotoSphere.objects.values_list("id", flat=True)), avant_photos)
        photo = PhotoSphere.objects.get(pk=photo.pk)
        self.assertNotEqual(photo.alt, "Texte modifié")
        for langue in CODES_LANGUES:
            self.assertTrue(photo.traduit("alt", langue).strip())
        contenu = ContenuAccueil.charger()
        self.assertRegex(contenu.video_fond.name, r"^contenus/fond(_\w{7})?\.mp4$")
        self.assertTrue(Path(contenu.video_fond.path).is_file())
        # pas de fichier orphelin : 9 photos, 1 affiche, 1 vidéo
        self.assertEqual(len(self.fichiers_media()), 11)
        self.assertEqual(len([f for f in self.fichiers_media() if f.startswith("contenus/sphere/")]), 9)
        self.assertFalse(Path(ancienne_video).exists() and ancienne_video == contenu.video_fond.path)
        self.assertNotEqual(ancienne_video, contenu.video_fond.path)

    def test_textes_et_coordonnees_de_l_accueil_intacts(self):
        contenu = ContenuAccueil.charger()
        contenu.titre, contenu.accroche, contenu.texte_partenaire = "Titre", "Accroche", "Partenaire"
        contenu.email = "contact@exemple.com"
        contenu.traductions = {"en": {"titre": "Title"}}
        contenu.save()
        attendus = {c: getattr(ContenuAccueil.objects.get(pk=1), c)
                    for c in ("titre", "accroche", "texte_partenaire", "telephones", "whatsapp", "email",
                              "adresse", "traductions")}
        self.assertEqual(attendus["telephones"], ["+237 6 99 81 16 35", "+237 6 78 82 93 13", "+237 6 56 43 58 46"])
        for options in ((), ("--forcer",)):
            self.importer(*options)
            contenu = ContenuAccueil.objects.get(pk=1)
            for champ, valeur in attendus.items():
                self.assertEqual(getattr(contenu, champ), valeur, champ)
        self.assertEqual(ContenuAccueil.objects.count(), 1)

    def test_aucune_ecriture_hors_des_deux_modeles(self):
        autres = [m for m in apps.get_models() if m not in (ContenuAccueil, PhotoSphere)]
        avant = {m: m.objects.count() for m in autres}
        self.importer()
        self.importer("--forcer")
        self.assertEqual({m: m.objects.count() for m in autres}, avant)
        self.assertEqual(sorted(self.fichiers_media())[0].split("/")[0], "contenus")
        self.assertTrue(all(f.startswith("contenus/") for f in self.fichiers_media()))


class ImportErreursTests(ImporterMediasTestCase):
    def test_fichier_manquant_rien_de_partiel(self):
        dossier = self.copie_dossier()
        (dossier / "images/atelier-pose.webp").unlink()  # dernière photo de l'ordre
        with self.assertRaises(CommandError) as erreur:
            self.importer(dossier=dossier)
        self.assertIn("atelier-pose.webp", str(erreur.exception))
        self.assertIn("Rien n'a été importé", str(erreur.exception))
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertFalse(ContenuAccueil.charger().video_fond)
        self.assertFalse(ContenuAccueil.charger().image_affiche)
        self.assertEqual(self.fichiers_media(), [])

    def test_video_manquante(self):
        dossier = self.copie_dossier()
        (dossier / "video/fond.mp4").unlink()
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertEqual(self.fichiers_media(), [])

    def test_fichier_non_utilise_manquant_sans_effet(self):
        dossier = self.copie_dossier()
        (dossier / "images/hall-femme.webp").unlink()
        self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 9)

    def test_dossier_ou_manifeste_absent_ou_illisible(self):
        dossier = self.copie_dossier()
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier / "inexistant")
        (dossier / "medias.json").write_text("{pas du json", encoding="utf-8")
        with self.assertRaisesMessage(CommandError, "Manifeste illisible"):
            self.importer(dossier=dossier)
        (dossier / "medias.json").unlink()
        with self.assertRaisesMessage(CommandError, "Manifeste introuvable"):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_alt_manquant_dans_une_langue(self):
        dossier = self.copie_dossier()
        chemin = dossier / "medias.json"
        manifeste = json.loads(chemin.read_text(encoding="utf-8"))
        for entree in manifeste["fichiers"]:
            if entree["fichier"].endswith("gradins.webp"):
                del entree["alt"]["ja"]
        chemin.write_text(json.dumps(manifeste), encoding="utf-8")
        with self.assertRaisesMessage(CommandError, "gradins.webp"):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_image_refusee_annule_tout(self):
        dossier = self.copie_dossier()
        (dossier / "images/atelier-pose.webp").write_bytes(b"pas une image")
        with self.assertRaises(Exception):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertFalse(ContenuAccueil.charger().video_fond)
        self.assertEqual(self.fichiers_media(), [])

    def test_messages_traduits(self):
        from django.utils import translation
        dossier = self.copie_dossier()
        (dossier / "video/fond.mp4").unlink()
        with translation.override("de"), self.assertRaisesMessage(CommandError, "Mediendatei fehlt"):
            self.importer(dossier=dossier)
