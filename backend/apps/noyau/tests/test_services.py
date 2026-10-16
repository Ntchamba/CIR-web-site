"""Tests des utilitaires du noyau : conversion WebP, permissions, pagination."""
from io import BytesIO
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.test import SimpleTestCase
from PIL import Image
from rest_framework.test import APIRequestFactory

from apps.noyau import images
from apps.noyau.images import ImagesOptimiseesMixin, convertir_en_webp, optimiser_champ_image
from apps.noyau.pagination import PaginationStandard
from apps.noyau.permissions import EstEquipe, EstSuperAdmin, LectureSeule


def image_en_octets(mode="RGB", taille=(200, 100), couleur="#1177A8", fmt="PNG", **options):
    tampon = BytesIO()
    Image.new(mode, taille, couleur).save(tampon, fmt, **options)
    tampon.seek(0)
    return tampon


def ouvrir(octets):
    image = Image.open(BytesIO(octets))
    image.load()
    return image


class ConversionWebpTests(SimpleTestCase):
    def test_reduit_en_gardant_les_proportions(self):
        resultat = ouvrir(convertir_en_webp(image_en_octets(taille=(3000, 1500)), largeur_max=1000))
        self.assertEqual(resultat.format, "WEBP")
        self.assertEqual(resultat.size, (1000, 500))

    def test_largeur_max_par_defaut_1280(self):
        self.assertEqual(images.LARGEUR_MAX, 1280)
        resultat = ouvrir(convertir_en_webp(image_en_octets(taille=(2560, 1000))))
        self.assertEqual(resultat.size, (1280, 500))

    def test_n_agrandit_jamais(self):
        resultat = ouvrir(convertir_en_webp(image_en_octets(taille=(300, 200)), largeur_max=1000))
        self.assertEqual(resultat.size, (300, 200))

    def test_hauteur_minimale_un_pixel(self):
        resultat = ouvrir(convertir_en_webp(image_en_octets(taille=(5000, 1)), largeur_max=100))
        self.assertEqual(resultat.size, (100, 1))

    def test_accepte_un_chemin(self):
        import tempfile, os
        with tempfile.TemporaryDirectory() as dossier:
            chemin = os.path.join(dossier, "photo.jpg")
            Image.new("RGB", (50, 40), "red").save(chemin, "JPEG")
            self.assertEqual(ouvrir(convertir_en_webp(chemin)).size, (50, 40))

    def test_jpeg_cmyk_converti_en_rgb(self):
        resultat = ouvrir(convertir_en_webp(image_en_octets("CMYK", fmt="JPEG", couleur=(0, 0, 0, 0))))
        self.assertEqual(resultat.mode, "RGB")

    def test_transparence_rgba_conservee(self):
        resultat = ouvrir(convertir_en_webp(image_en_octets("RGBA", couleur=(0, 0, 0, 0))))
        self.assertEqual(resultat.mode, "RGBA")

    def test_transparence_niveaux_de_gris_conservee(self):
        resultat = ouvrir(convertir_en_webp(image_en_octets("LA", couleur=(0, 0))))
        self.assertEqual(resultat.mode, "RGBA")

    def test_transparence_png_a_palette_conservee(self):
        """Logos PNG/GIF à palette : la transparence ne doit pas devenir un fond opaque."""
        tampon = BytesIO()
        Image.new("RGBA", (20, 20), (0, 0, 0, 0)).convert("P").save(tampon, "PNG")
        tampon.seek(0)
        resultat = ouvrir(convertir_en_webp(tampon))
        self.assertEqual(resultat.mode, "RGBA")
        self.assertEqual(resultat.getpixel((0, 0))[3], 0)

    def test_orientation_exif_appliquee(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # rotation de 90° demandée par l'appareil photo
        source = image_en_octets(taille=(200, 100), fmt="JPEG", exif=exif.tobytes())
        self.assertEqual(ouvrir(convertir_en_webp(source)).size, (100, 200))

    def test_qualite_influe_sur_le_poids(self):
        import random
        random.seed(1)
        bruit = Image.new("RGB", (300, 300))
        bruit.putdata([tuple(random.randrange(256) for _ in range(3)) for _ in range(300 * 300)])
        tampon = BytesIO()
        bruit.save(tampon, "PNG")
        faible = convertir_en_webp(BytesIO(tampon.getvalue()), qualite=20)
        forte = convertir_en_webp(BytesIO(tampon.getvalue()), qualite=95)
        self.assertLess(len(faible), len(forte))

    def test_fichier_non_image_refuse(self):
        with self.assertRaises(Exception):
            convertir_en_webp(BytesIO(b"pas une image"))


class ChampFactice(BytesIO):
    """Imite un FieldFile non enregistré (nom, _committed, open, save)."""

    def __init__(self, octets, nom="dossier/photo.png", committed=False):
        super().__init__(octets)
        self.name = nom
        self._committed = committed
        self.enregistrements = []

    def __bool__(self):
        return bool(self.name)

    def open(self, mode="rb"):
        self.seek(0)

    def save(self, nom, contenu, save=True):
        self.enregistrements.append((nom, contenu.read(), save))
        self.name = nom
        self._committed = True


class OptimiserChampTests(SimpleTestCase):
    def test_remplace_par_webp_sans_enregistrer_le_modele(self):
        champ = ChampFactice(image_en_octets(taille=(2000, 1000)).getvalue())
        optimiser_champ_image(champ, largeur_max=500)
        self.assertEqual(len(champ.enregistrements), 1)
        nom, octets, save = champ.enregistrements[0]
        self.assertEqual(nom, "photo.webp")
        self.assertFalse(save)
        self.assertEqual(ouvrir(octets).size, (500, 250))
        self.assertTrue(champ._cir_optimise)

    def test_ignore_champ_vide(self):
        champ = ChampFactice(b"", nom="")
        optimiser_champ_image(champ)
        self.assertEqual(champ.enregistrements, [])

    def test_ignore_none(self):
        optimiser_champ_image(None)  # ne lève rien

    def test_ignore_fichier_deja_enregistre(self):
        champ = ChampFactice(image_en_octets().getvalue(), committed=True)
        optimiser_champ_image(champ)
        self.assertEqual(champ.enregistrements, [])

    def test_pas_de_double_conversion(self):
        champ = ChampFactice(image_en_octets().getvalue())
        champ._cir_optimise = True
        optimiser_champ_image(champ)
        self.assertEqual(champ.enregistrements, [])

    def test_mixin_optimise_chaque_champ_declare(self):
        class Base:
            def save(self, *args, **kwargs):
                self.enregistre = (args, kwargs)

        class Modele(ImagesOptimiseesMixin, Base):
            champs_images = {"photo": 300, "vignette": 100}

        objet = Modele()
        objet.photo = ChampFactice(image_en_octets(taille=(900, 300)).getvalue())
        objet.vignette = ChampFactice(image_en_octets(taille=(900, 300)).getvalue())
        objet.save(update_fields=["photo"])
        self.assertEqual(ouvrir(objet.photo.enregistrements[0][1]).size, (300, 100))
        self.assertEqual(ouvrir(objet.vignette.enregistrements[0][1]).size, (100, 33))
        self.assertEqual(objet.enregistre, ((), {"update_fields": ["photo"]}))


def requete(utilisateur, methode="get"):
    req = getattr(APIRequestFactory(), methode)("/")
    req.user = utilisateur
    return req


def utilisateur(role=None, actif=True, connecte=True):
    return SimpleNamespace(
        is_authenticated=connecte, is_active=actif,
        est_equipe=role in ("membre", "super_admin"), est_super_admin=role == "super_admin",
    )


class PermissionsTests(SimpleTestCase):
    def test_est_equipe(self):
        p = EstEquipe()
        self.assertTrue(p.has_permission(requete(utilisateur("membre")), None))
        self.assertTrue(p.has_permission(requete(utilisateur("super_admin")), None))
        self.assertFalse(p.has_permission(requete(utilisateur("client")), None))
        self.assertFalse(p.has_permission(requete(utilisateur("membre", actif=False)), None))
        self.assertFalse(p.has_permission(requete(AnonymousUser()), None))
        self.assertFalse(p.has_permission(requete(None), None))

    def test_est_super_admin(self):
        p = EstSuperAdmin()
        self.assertTrue(p.has_permission(requete(utilisateur("super_admin")), None))
        self.assertFalse(p.has_permission(requete(utilisateur("membre")), None))
        self.assertFalse(p.has_permission(requete(utilisateur("client")), None))
        self.assertFalse(p.has_permission(requete(utilisateur("super_admin", actif=False)), None))
        self.assertFalse(p.has_permission(requete(AnonymousUser()), None))

    def test_lecture_seule(self):
        p = LectureSeule()
        for methode in ("get", "head", "options"):
            self.assertTrue(p.has_permission(requete(None, methode), None))
        for methode in ("post", "put", "patch", "delete"):
            self.assertFalse(p.has_permission(requete(None, methode), None))

    def test_messages_en_francais(self):
        self.assertIn("équipe", EstEquipe.message)
        self.assertIn("super-administrateurs", EstSuperAdmin.message)


class PaginationTests(SimpleTestCase):
    def paginer(self, url, n=150):
        from rest_framework.request import Request
        pagination = PaginationStandard()
        page = pagination.paginate_queryset(list(range(n)), Request(APIRequestFactory().get(url)))
        return pagination, page

    def test_24_par_defaut(self):
        self.assertEqual(len(self.paginer("/")[1]), 24)

    def test_taille_demandee(self):
        self.assertEqual(len(self.paginer("/?taille=10")[1]), 10)

    def test_taille_plafonnee_a_100(self):
        self.assertEqual(len(self.paginer("/?taille=1000")[1]), 100)

    def test_taille_invalide_revient_a_24(self):
        for valeur in ("0", "-5", "abc"):
            self.assertEqual(len(self.paginer(f"/?taille={valeur}")[1]), 24, valeur)

    def test_reponse_contient_count_et_liens(self):
        pagination, page = self.paginer("/?page=2")
        reponse = pagination.get_paginated_response(page)
        self.assertEqual(reponse.data["count"], 150)
        self.assertIsNotNone(reponse.data["next"])
        self.assertIsNotNone(reponse.data["previous"])
        self.assertEqual(reponse.data["results"][0], 24)

    def test_reglage_par_defaut_de_l_api(self):
        from django.conf import settings
        self.assertEqual(settings.REST_FRAMEWORK["DEFAULT_PAGINATION_CLASS"], "apps.noyau.pagination.PaginationStandard")


class LimitesImagesTests(SimpleTestCase):
    """Fichiers trop lourds, trop grands en pixels ou illisibles : refusés avant décodage (ImageInvalide)."""

    def test_limites_par_defaut(self):
        self.assertEqual(images.OCTETS_MAX, 10 * 1024 * 1024)
        self.assertEqual(images.PIXELS_MAX, 40_000_000)
        self.assertTrue(issubclass(images.ImageInvalide, ValueError))

    def test_fichier_trop_lourd(self):
        source = image_en_octets(taille=(100, 100))
        with self.assertRaises(images.ImageInvalide) as ctx:
            convertir_en_webp(source, octets_max=len(source.getvalue()) - 1)
        self.assertIn("lourde", str(ctx.exception))

    def test_fichier_a_la_limite_accepte(self):
        source = image_en_octets(taille=(100, 100))
        convertir_en_webp(source, octets_max=len(source.getvalue()))

    def test_taille_lue_sans_deplacer_la_position(self):
        source = image_en_octets()
        source.seek(3)
        self.assertEqual(images.taille_en_octets(source), len(source.getvalue()))
        self.assertEqual(source.tell(), 3)

    def test_taille_d_un_fichier_envoye_et_d_un_chemin(self):
        import os
        import tempfile
        from django.core.files.uploadedfile import SimpleUploadedFile
        envoi = SimpleUploadedFile("photo.png", image_en_octets().getvalue(), content_type="image/png")
        self.assertEqual(images.taille_en_octets(envoi), envoi.size)
        with self.assertRaises(images.ImageInvalide):
            convertir_en_webp(envoi, octets_max=10)
        with tempfile.TemporaryDirectory() as dossier:
            chemin = os.path.join(dossier, "photo.png")
            with open(chemin, "wb") as f:
                f.write(image_en_octets().getvalue())
            self.assertEqual(images.taille_en_octets(chemin), os.path.getsize(chemin))
            with self.assertRaises(images.ImageInvalide):
                convertir_en_webp(chemin, octets_max=10)

    def test_trop_de_pixels_refuse_avant_decodage(self):
        source = image_en_octets(taille=(200, 100))
        with mock.patch.object(Image.Image, "load", side_effect=AssertionError("décodé")), \
                self.assertRaises(images.ImageInvalide) as ctx:
            convertir_en_webp(source, pixels_max=200 * 100 - 1)
        self.assertIn("pixels", str(ctx.exception))
        convertir_en_webp(image_en_octets(taille=(200, 100)), pixels_max=200 * 100)

    def test_bombe_de_decompression_refusee(self):
        """En-tête PNG annonçant 20000 x 20000 px dans un fichier minuscule."""
        import struct
        import zlib
        def bloc(type_, donnees):
            return struct.pack(">I", len(donnees)) + type_ + donnees + struct.pack(">I", zlib.crc32(type_ + donnees))
        png = b"\x89PNG\r\n\x1a\n" + bloc(b"IHDR", struct.pack(">IIBBBBB", 20000, 20000, 8, 2, 0, 0, 0)) \
            + bloc(b"IDAT", zlib.compress(b"")) + bloc(b"IEND", b"")
        with self.assertRaises(images.ImageInvalide):
            convertir_en_webp(BytesIO(png))

    def test_fichier_illisible(self):
        with self.assertRaises(images.ImageInvalide) as ctx:
            convertir_en_webp(BytesIO(b"pas une image"))
        self.assertIn("illisible", str(ctx.exception))

    def test_palette_sans_transparence_en_rgb(self):
        tampon = BytesIO()
        Image.new("RGB", (20, 20), "red").convert("P").save(tampon, "PNG")
        tampon.seek(0)
        self.assertEqual(ouvrir(convertir_en_webp(tampon)).mode, "RGB")

    def test_gif_transparent_en_rgba(self):
        tampon = BytesIO()
        Image.new("RGBA", (20, 20), (0, 0, 0, 0)).convert("P").save(tampon, "GIF", transparency=0)
        tampon.seek(0)
        self.assertEqual(ouvrir(convertir_en_webp(tampon)).mode, "RGBA")

    def test_optimiser_champ_propage_le_refus(self):
        champ = ChampFactice(b"pas une image")
        with self.assertRaises(images.ImageInvalide):
            optimiser_champ_image(champ)
        self.assertEqual(champ.enregistrements, [])
