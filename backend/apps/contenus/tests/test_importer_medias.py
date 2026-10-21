"""Commande importer_medias_reference : idempotence, --forcer, fichier manquant, accueil intact, alt en 5 langues."""
import json
import shutil
import tempfile
from io import StringIO
from unittest import mock
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


class ImportAdversesTests(ImporterMediasTestCase):
    """Cas adverses : --dossier, chemins sortants, échec au milieu, forçage, taille."""

    def compter_autres(self):
        autres = [m for m in apps.get_models() if m not in (ContenuAccueil, PhotoSphere)]
        return {m: m.objects.count() for m in autres}

    def ecrire_manifeste(self, dossier, modifier):
        chemin = dossier / "medias.json"
        manifeste = json.loads(chemin.read_text(encoding="utf-8"))
        modifier(manifeste)
        chemin.write_text(json.dumps(manifeste), encoding="utf-8")

    def test_aucune_ligne_ailleurs_ni_realisation_ni_produit(self):
        avant = self.compter_autres()
        self.importer()
        self.importer("--forcer")
        self.assertEqual(self.compter_autres(), avant)

    def test_forcer_supprime_les_anciens_fichiers_et_garde_les_ids(self):
        self.importer()
        anciens = set(self.fichiers_media())
        self.importer("--forcer")
        nouveaux = set(self.fichiers_media())
        self.assertEqual(len(nouveaux), 11)
        self.assertEqual(PhotoSphere.objects.count(), 9)
        for photo in PhotoSphere.objects.all():
            self.assertTrue(Path(photo.image.path).is_file())
        self.assertTrue(anciens.isdisjoint(nouveaux) or len(nouveaux) == 11)

    def test_forcer_en_echec_conserve_les_anciens_fichiers(self):
        self.importer()
        avant = self.fichiers_media()
        photos = list(PhotoSphere.objects.values_list("id", "image", "alt"))
        dossier = self.copie_dossier()
        (dossier / "images/atelier-pose.webp").write_bytes(b"pas une image")
        with self.assertRaises(Exception):
            self.importer("--forcer", dossier=dossier)
        self.assertEqual(self.fichiers_media(), avant)
        self.assertEqual(list(PhotoSphere.objects.values_list("id", "image", "alt")), photos)

    def test_echec_au_milieu_nettoie_les_fichiers_ecrits(self):
        dossier = self.copie_dossier()
        (dossier / "images/parking-vert.webp").write_bytes(b"pas une image")  # 5e photo : 4 déjà écrites
        with self.assertRaises(Exception):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertFalse(ContenuAccueil.charger().video_fond)
        self.assertFalse(ContenuAccueil.charger().image_affiche)
        self.assertEqual(self.fichiers_media(), [])

    def test_manifeste_invalide_formes_diverses(self):
        dossier = self.copie_dossier()
        for contenu in ("[]", '{"fichiers": 3}', '{"fichiers": [1]}', '{"fichiers": [{"usage": "sphere"}]}',
                        '{"fichiers": [{"usage": "sphere", "fichier": 5}]}'):
            (dossier / "medias.json").write_text(contenu, encoding="utf-8")
            with self.assertRaisesMessage(CommandError, "Manifeste illisible"):
                self.importer(dossier=dossier)
        self.assertEqual(self.fichiers_media(), [])
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_alt_vide_ou_absent_refuse(self):
        for alt in (None, "texte", {"fr": "x"}, {c: "  " for c in CODES_LANGUES}):
            dossier = self.copie_dossier()

            def modifier(m, alt=alt):
                for e in m["fichiers"]:
                    if e["fichier"].endswith("salon-pose.webp"):
                        if alt is None:
                            del e["alt"]
                        else:
                            e["alt"] = alt
            self.ecrire_manifeste(dossier, modifier)
            with self.assertRaisesMessage(CommandError, "salon-pose.webp"):
                self.importer(dossier=dossier)
            self.assertEqual(PhotoSphere.objects.count(), 0)
            self.assertEqual(self.fichiers_media(), [])

    def test_dossier_avec_point_point_refuse(self):
        dossier = self.copie_dossier()
        with self.assertRaisesMessage(CommandError, "« .. »"):
            self.importer(dossier=dossier / "images" / "..")
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_echec_de_save_apres_ecriture_du_fichier_sans_orphelin(self):
        appels = []
        original = PhotoSphere._do_insert

        def echoue_a_la_troisieme(*args, **kwargs):
            appels.append(1)
            if len(appels) == 3:
                raise RuntimeError("échec simulé")
            return original(*args, **kwargs)

        with mock.patch.object(PhotoSphere, "_do_insert", autospec=True, side_effect=echoue_a_la_troisieme):
            with self.assertRaises(RuntimeError):
                self.importer()
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertEqual(self.fichiers_media(), [])

    def test_nom_de_fichier_avec_remontee_refuse(self):
        dossier = self.copie_dossier()
        secret = dossier.parent / "secret.webp"
        shutil.copy(DOSSIER / "images/gradins.webp", secret)

        def modifier(m):
            for e in m["fichiers"]:
                if e["fichier"].endswith("gradins.webp"):
                    e["fichier"] = "../secret.webp"
        self.ecrire_manifeste(dossier, modifier)
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertEqual(self.fichiers_media(), [])

    def test_nom_de_fichier_absolu_refuse(self):
        dossier = self.copie_dossier()
        cible = str(DOSSIER / "images/gradins.webp")

        def modifier(m):
            for e in m["fichiers"]:
                if e["fichier"].endswith("gradins.webp"):
                    e["fichier"] = cible
        self.ecrire_manifeste(dossier, modifier)
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_lien_symbolique_sortant_refuse(self):
        dossier = self.copie_dossier()
        hors = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, hors, ignore_errors=True)
        shutil.copy(DOSSIER / "images/gradins.webp", hors / "externe.webp")
        (dossier / "images/gradins.webp").unlink()
        (dossier / "images/gradins.webp").symlink_to(hors / "externe.webp")
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertEqual(self.fichiers_media(), [])

    def test_manifeste_lien_symbolique_sortant_refuse(self):
        dossier = self.copie_dossier()
        hors = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, hors, ignore_errors=True)
        shutil.copy(DOSSIER / "medias.json", hors / "medias.json")
        (dossier / "medias.json").unlink()
        (dossier / "medias.json").symlink_to(hors / "medias.json")
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_video_invalide_refusee(self):
        dossier = self.copie_dossier()
        (dossier / "video/fond.mp4").write_bytes(b"ceci n'est pas une video")
        with self.assertRaises(Exception):
            self.importer(dossier=dossier)
        self.assertFalse(ContenuAccueil.charger().video_fond)
        self.assertEqual(PhotoSphere.objects.count(), 0)

    def test_image_trop_lourde_refusee(self):
        dossier = self.copie_dossier()
        with Image.open(dossier / "images/atelier-pose.webp") as image:
            image.resize((9000, 5000)).save(dossier / "images/atelier-pose.webp", "WEBP", quality=1)
        with self.assertRaises(Exception):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertEqual(self.fichiers_media(), [])

    def test_taille_totale_des_medias(self):
        total = sum(p.stat().st_size for p in DOSSIER.rglob("*") if p.is_file())
        self.assertLess(total, 5 * 1024 * 1024)
        self.importer()
        poids = sum((self.media / f).stat().st_size for f in self.fichiers_media())
        self.assertLess(poids, 3 * 1024 * 1024)

    def test_alt_importes_exacts_et_sans_chiffre_ou_nom_propre(self):
        self.importer()
        manifeste = json.loads((DOSSIER / "medias.json").read_text(encoding="utf-8"))
        attendus = {Path(e["fichier"]).stem: e["alt"] for e in manifeste["fichiers"] if e["usage"] == "sphere"}
        for photo, nom in zip(PhotoSphere.objects.all(), SPHERE):
            for langue in CODES_LANGUES:
                self.assertEqual(photo.traduit("alt", langue), attendus[nom][langue])
        for nom in ("Jiuye", "Douala", "Cameroun", "CIR"):
            self.assertFalse(any(nom in t for a in attendus.values() for t in a.values()), nom)


class ImportContournementsTests(ImporterMediasTestCase):
    """Tentatives de contournement des vérifications de chemin."""

    def avec_nom(self, dossier, cible, nom):
        chemin = dossier / "medias.json"
        manifeste = json.loads(chemin.read_text(encoding="utf-8"))
        for e in manifeste["fichiers"]:
            if e["fichier"].endswith(cible):
                e["fichier"] = nom
        chemin.write_text(json.dumps(manifeste), encoding="utf-8")

    def refuse(self, dossier):
        with self.assertRaises(CommandError):
            self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 0)
        self.assertEqual(self.fichiers_media(), [])

    def test_noms_tordus_refuses_ou_introuvables(self):
        for nom in ("images\\..\\..\\x.webp", "images/../../x.webp", "..\\x.webp", "%2e%2e/x.webp",
                    "images/%2e%2e/gradins.webp", "images/gradins.webp\0", "C:\\x.webp", "\\\\hote\\x.webp",
                    "images/gradins.webp/..", "IMAGES/GRADINS.WEBP"):
            dossier = self.copie_dossier()
            self.avec_nom(dossier, "gradins.webp", nom)
            with self.subTest(nom=nom):
                self.refuse(dossier)

    def test_fichier_du_manifeste_qui_est_un_dossier(self):
        dossier = self.copie_dossier()
        self.avec_nom(dossier, "gradins.webp", "images")
        self.refuse(dossier)

    def test_fichier_special_fifo(self):
        import os
        dossier = self.copie_dossier()
        (dossier / "images/gradins.webp").unlink()
        os.mkfifo(dossier / "images/gradins.webp")
        self.refuse(dossier)

    def test_lien_symbolique_dans_un_sous_dossier_sortant(self):
        dossier = self.copie_dossier()
        hors = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, hors, ignore_errors=True)
        shutil.copy(DOSSIER / "images/gradins.webp", hors / "gradins.webp")
        (dossier / "lien").symlink_to(hors, target_is_directory=True)
        self.avec_nom(dossier, "gradins.webp", "lien/gradins.webp")
        self.refuse(dossier)

    def test_lien_symbolique_interne_accepte(self):
        dossier = self.copie_dossier()
        (dossier / "alias").symlink_to(dossier / "images", target_is_directory=True)
        self.avec_nom(dossier, "gradins.webp", "alias/gradins.webp")
        self.importer(dossier=dossier)
        self.assertEqual(PhotoSphere.objects.count(), 9)

    def test_dossier_lui_meme_lien_symbolique_ou_avec_point_point(self):
        dossier = self.copie_dossier()
        with self.assertRaises(CommandError):
            self.importer(dossier=str(dossier / "images") + "/../")

    def test_chemin_retenu_est_resolu_pas_de_course(self):
        """Le chemin lu ensuite doit être le chemin résolu : un lien changé après la vérification ne compte plus."""
        from apps.contenus.management.commands.importer_medias_reference import Command
        dossier = self.copie_dossier()
        (dossier / "alias").symlink_to(dossier / "images", target_is_directory=True)
        manifeste = json.loads((dossier / "medias.json").read_text(encoding="utf-8"))
        self.avec_nom(dossier, "gradins.webp", "alias/gradins.webp")
        entrees = json.loads((dossier / "medias.json").read_text(encoding="utf-8"))["fichiers"]
        _video, _affiche, photos = Command()._preparer(dossier, entrees)
        for _entree, chemin in photos:
            self.assertEqual(chemin, chemin.resolve(), chemin)
