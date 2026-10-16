"""Tests des utilitaires du noyau : conversion WebP, permissions, pagination."""
from io import BytesIO
from types import SimpleNamespace

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
