"""Tests complémentaires de la vitrine (revue de l'agent backend-testeur, vague 1).

Jeton périmé sur les lectures publiques, fichiers conservés si l'enregistrement échoue, liens de démo,
modération, quota, visibilité publique et requêtes N+1.
"""
from datetime import timedelta
from pathlib import Path
from unittest import mock

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.catalogue.models import Famille, Produit
from apps.noyau.images import ImageInvalide
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre, image_png, video_mp4
from apps.vitrine import services
from apps.vitrine.models import Demo, Realisation, StatutTemoignage, Temoignage

URL = "/api/vitrine/"
URL_ADMIN = "/api/admin/vitrine/"
TEXTE = "Un sol magnifique et très résistant, je recommande."


def _nombre_requetes(client, url):
    with CaptureQueriesContext(connection) as requetes:
        reponse = client.get(url)
    assert reponse.status_code == 200, reponse.content
    return len(requetes)


class JetonPerimeTests(APITestCase):
    """Contrat et README : lecture publique sans authentification, un jeton périmé est ignoré."""

    def test_lectures_publiques_avec_jeton_invalide(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer jeton-perime")
        for route in ("realisations/", "demos/", "temoignages/"):
            with self.subTest(route=route):
                self.assertEqual(self.client.get(f"{URL}{route}").status_code, 200)


class AdresseIntegrationTests(SimpleTestCase):
    def test_liens_acceptes(self):
        cas = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://m.youtube.com/shorts/dQw4w9WgXcQ": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "http://youtu.be/dQw4w9WgXcQ?si=abc": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://vimeo.com/76979871": "https://player.vimeo.com/video/76979871",
            "https://player.vimeo.com/video/76979871?h=x": "https://player.vimeo.com/video/76979871",
        }
        for lien, attendu in cas.items():
            with self.subTest(lien=lien):
                self.assertEqual(services.adresse_integration(lien), attendu)

    def test_liens_refuses(self):
        for lien in ("javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ",
                     "https://youtube.com.exemple.com/watch?v=dQw4w9WgXcQ",
                     "https://youtube.com@exemple.com/watch?v=dQw4w9WgXcQ",
                     "https://exemple.com/vimeo.com/76979871",
                     "https://www.youtube.com/watch?v=dQw4w9WgXcQ\"><script>",
                     "https://www.youtube.com/watch?v=court",
                     "https://youtu.be/../../dQw4w9WgXcQ",
                     "ftp://vimeo.com/76979871", "", None):
            with self.subTest(lien=lien):
                self.assertIsNone(services.adresse_integration(lien))


class ModerationTexteTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_client())

    def test_textes_refuses(self):
        for texte in ("Très bon travail, voir www.monsite.cm pour plus",
                      "Très bon travail, écrivez-moi à moi@exemple.cm merci",
                      "Très bon travail, appelez le +237 6 99 81 16 35 merci",
                      "Très bon travail, voir https://exemple.com merci",
                      "x" * 801, "   " + "a" * 10 + "        "):
            with self.subTest(texte=texte[:40]):
                r = self.client.post(f"{URL}temoignages/", {"texte": texte, "note": 4}, format="json")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn("texte", r.data)
        self.assertFalse(Temoignage.objects.exists())

    def test_note_et_type_de_chantier_controles(self):
        for donnees in ({"note": 0}, {"note": "cinq"}, {"note": True}, {"type_chantier": "piscine"}):
            with self.subTest(donnees=donnees):
                r = self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4, **donnees}, format="json")
                self.assertEqual(r.status_code, 400, r.content)

    def test_message_traduit(self):
        r = self.client.post(f"{URL}temoignages/", {"texte": "court", "note": 4}, format="json",
                             HTTP_ACCEPT_LANGUAGE="ja")
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("caractères", str(r.data["texte"][0]))

    def test_langue_d_ecriture_chinois(self):
        r = self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 5}, format="json",
                             HTTP_ACCEPT_LANGUAGE="zh-CN")
        self.assertEqual((r.status_code, r.data["langue"]), (201, "zh"))


class QuotaTests(APITestCase):
    def test_seuls_les_depots_des_dernieres_24_h_comptent(self):
        client = creer_client()
        ancien = timezone.now() - timedelta(hours=25)
        for _ in range(5):
            Temoignage.objects.create(auteur=client, nom_affiche="A", texte=TEXTE, note=4, cree_le=ancien)
        self.client.force_authenticate(client)
        r = self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4}, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_quota_par_compte(self):
        premier = creer_client()
        for _ in range(5):
            Temoignage.objects.create(auteur=premier, nom_affiche="A", texte=TEXTE, note=4)
        self.client.force_authenticate(premier)
        self.assertEqual(self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4},
                                          format="json").status_code, 429)
        self.client.force_authenticate(creer_client("autre@exemple.cm"))
        self.assertEqual(self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4},
                                          format="json").status_code, 201)


class VisibilitePubliqueTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client_compte = creer_client()

    def test_temoignages_en_attente_et_refuses_jamais_publics(self):
        for statut in (StatutTemoignage.EN_ATTENTE, StatutTemoignage.REFUSE):
            Temoignage.objects.create(auteur=self.client_compte, nom_affiche="A", texte=TEXTE, note=4, statut=statut,
                                      motif_refus="Motif interne")
        r = self.client.get(f"{URL}temoignages/")
        self.assertEqual(r.data["count"], 0)
        self.assertEqual(self.client.get(f"{URL}temoignages/1/").status_code, 404)  # pas de route détail

    def test_mes_temoignages_motif_seulement_si_refuse(self):
        Temoignage.objects.create(auteur=self.client_compte, nom_affiche="A", texte=TEXTE, note=4,
                                  statut=StatutTemoignage.PUBLIE, motif_refus="ancien motif")
        self.client.force_authenticate(self.client_compte)
        r = self.client.get(f"{URL}temoignages/miens/")
        self.assertIsNone(r.data["results"][0]["motif_refus"])

    def test_demo_publiee_ne_montre_pas_une_realisation_cachee(self):
        cachee = Realisation.objects.create(titre="Brouillon", type_chantier="maison", image_apres=image_png(),
                                            publie=False)
        Demo.objects.create(titre="Pose", lien="https://youtu.be/dQw4w9WgXcQ", realisation=cachee)
        r = self.client.get(f"{URL}demos/")
        self.assertNotIn("Brouillon", str(r.data))
        self.assertNotIn("realisation", r.data["results"][0])

    def test_realisation_avant_apres_textes_alternatifs(self):
        r = Realisation.objects.create(titre="Salon", type_chantier="maison", image_apres=image_png(),
                                       image_avant=image_png())
        donnees = self.client.get(f"{URL}realisations/{r.slug}/", HTTP_ACCEPT_LANGUAGE="de").data
        self.assertTrue(donnees["image_avant"]["url"].endswith(".webp"))
        self.assertNotIn("avant les travaux", donnees["image_avant"]["alt"])
        self.assertNotIn("après les travaux", donnees["image_apres"]["alt"])


class RequetesN1Tests(MediasTemporairesMixin, APITestCase):
    def _realisation(self, numero, produits):
        r = Realisation.objects.create(titre=f"Chantier {numero}", type_chantier="maison", image_apres=image_png())
        r.produits.set(produits)

    def test_listes_publiques_et_equipe(self):
        famille = Famille.objects.create(nom="Finitions")
        produits = [Produit.objects.create(famille=famille, nom=f"P{i}") for i in range(3)]
        auteur = creer_client()
        self._realisation(0, produits)
        Demo.objects.create(titre="D0", lien="https://youtu.be/dQw4w9WgXcQ")
        Temoignage.objects.create(auteur=auteur, nom_affiche="A", texte=TEXTE, note=4, statut="publie")
        membre = creer_membre()
        routes_publiques = [f"{URL}realisations/", f"{URL}demos/", f"{URL}temoignages/"]
        routes_equipe = [f"{URL_ADMIN}realisations/", f"{URL_ADMIN}demos/", f"{URL_ADMIN}temoignages/"]
        avant = [_nombre_requetes(self.client, route) for route in routes_publiques]
        self.client.force_authenticate(membre)
        avant_equipe = [_nombre_requetes(self.client, route) for route in routes_equipe]
        for i in range(1, 5):
            self._realisation(i, produits)
            Demo.objects.create(titre=f"D{i}", lien="https://youtu.be/dQw4w9WgXcQ")
            Temoignage.objects.create(auteur=creer_client(f"c{i}@exemple.cm"), nom_affiche="A", texte=TEXTE, note=4,
                                      statut="publie", modere_par=membre)
        self.assertEqual([_nombre_requetes(self.client, route) for route in routes_equipe], avant_equipe)
        self.client.force_authenticate(None)
        self.assertEqual([_nombre_requetes(self.client, route) for route in routes_publiques], avant)


class FichiersConservesTests(MediasTemporairesMixin, APITestCase):
    """Un enregistrement refusé (400) ne doit pas effacer les fichiers encore référencés en base."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(creer_membre())

    def test_retirer_la_seule_video_d_une_demo_sans_lien(self):
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Pose", "video": video_mp4()}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        demo = Demo.objects.get(pk=r.data["id"])
        chemin = Path(demo.video.path)
        r = self.client.patch(f"{URL_ADMIN}demos/{demo.id}/", {"video": None}, format="json")
        self.assertEqual(r.status_code, 400)
        demo.refresh_from_db()
        self.assertTrue(demo.video)
        self.assertTrue(chemin.exists(), "la vidéo a été effacée du disque alors que la modification est refusée")

    def test_photo_avant_conservee_si_la_photo_apres_est_refusee(self):
        r = self.client.post(f"{URL_ADMIN}realisations/", {"titre": "Salon", "type_chantier": "maison",
                                                           "image_apres": image_png(), "image_avant": image_png()},
                             format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        realisation = Realisation.objects.get(pk=r.data["id"])
        chemin = Path(realisation.image_avant.path)
        with mock.patch("apps.noyau.medias.optimiser_champ_image", side_effect=ImageInvalide("Trop lourde")):
            r = self.client.patch(f"{URL_ADMIN}realisations/{realisation.id}/",
                                  {"image_avant": "", "image_apres": image_png("nouvelle.png")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data, {"image_apres": ["Trop lourde"]})
        realisation.refresh_from_db()
        self.assertTrue(realisation.image_avant)
        self.assertTrue(chemin.exists(), "la photo avant a été effacée alors que la modification est refusée")


class EquipeComplementsTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.membre = creer_membre()
        self.client.force_authenticate(self.membre)

    def test_moderation_reservee_et_tracee(self):
        t = Temoignage.objects.create(auteur=creer_client(), nom_affiche="A", texte=TEXTE, note=4)
        self.client.force_authenticate(creer_client("autre@exemple.cm"))
        self.assertEqual(self.client.post(f"{URL_ADMIN}temoignages/{t.id}/publier/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(f"{URL_ADMIN}temoignages/{t.id}/refuser/").status_code, 401)
        t.refresh_from_db()
        self.assertEqual(t.statut, StatutTemoignage.EN_ATTENTE)
        self.client.force_authenticate(self.membre)
        r = self.client.post(f"{URL_ADMIN}temoignages/{t.id}/refuser/", {"motif": "x" * 501}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"{URL_ADMIN}temoignages/{t.id}/publier/")
        self.assertEqual(r.data["modere_par"], self.membre.id)
        self.assertIsNotNone(r.data["modere_le"])
        self.assertEqual(self.client.post(f"{URL_ADMIN}temoignages/99999/publier/").status_code, 404)

    def test_temoignage_sans_auteur(self):
        t = Temoignage.objects.create(nom_affiche="Compte supprimé", texte=TEXTE, note=4)
        self.assertIsNone(self.client.get(f"{URL_ADMIN}temoignages/{t.id}/").data["auteur"])

    def test_temoignages_non_modifiables_par_l_equipe(self):
        t = Temoignage.objects.create(nom_affiche="A", texte=TEXTE, note=4)
        self.assertEqual(self.client.patch(f"{URL_ADMIN}temoignages/{t.id}/", {"texte": "Autre"},
                                           format="json").status_code, 405)

    def test_demo_lien_et_duree(self):
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "L", "lien": "https://vimeo.com/76979871",
                                                    "duree": "1:45"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["integration"], "https://player.vimeo.com/video/76979871")
        for donnees in ({"duree": "abc"}, {"lien": "javascript:alert(1)"}, {"lien": "https://youtube.com.exemple.com/x"}):
            with self.subTest(donnees=donnees):
                r = self.client.patch(f"{URL_ADMIN}demos/{Demo.objects.get().id}/", donnees, format="json")
                self.assertEqual(r.status_code, 400, r.content)

    def test_realisation_photo_apres_non_retirable_et_produit_inconnu(self):
        r = Realisation.objects.create(titre="Salon", type_chantier="maison", image_apres=image_png())
        rep = self.client.patch(f"{URL_ADMIN}realisations/{r.id}/", {"image_apres": ""}, format="multipart")
        self.assertEqual(rep.status_code, 400)
        rep = self.client.patch(f"{URL_ADMIN}realisations/{r.id}/", {"produits": [99999]}, format="json")
        self.assertEqual(rep.status_code, 400)
        self.assertIn("produits", rep.data)
        rep = self.client.patch(f"{URL_ADMIN}realisations/{r.id}/", {"traductions": {"en": {"ville": "x"}}},
                                format="json")
        self.assertEqual(rep.status_code, 400)  # la ville ne se traduit pas


class CorrectionsRelectureTests(MediasTemporairesMixin, APITestCase):
    """Seconde relecture : remplacement de fichiers, ville du témoignage, Demo.clean(), jeton sur « miens »."""

    def setUp(self):
        super().setUp()
        self.membre = creer_membre()

    def test_remplacement_de_la_photo_apres_efface_l_ancienne_seulement_si_reussi(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post(f"{URL_ADMIN}realisations/", {"titre": "Salon", "type_chantier": "maison",
                                                           "image_apres": image_png()}, format="multipart")
        realisation = Realisation.objects.get(pk=r.data["id"])
        ancienne = Path(realisation.image_apres.path)
        with mock.patch("apps.noyau.medias.optimiser_champ_image", side_effect=ImageInvalide("Trop lourde")):
            r = self.client.patch(f"{URL_ADMIN}realisations/{realisation.id}/", {"image_apres": image_png("b.png")},
                                  format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(ancienne.exists())
        r = self.client.patch(f"{URL_ADMIN}realisations/{realisation.id}/", {"image_apres": image_png("c.png")},
                              format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        realisation.refresh_from_db()
        self.assertFalse(ancienne.exists())
        self.assertTrue(Path(realisation.image_apres.path).exists())

    def test_suppression_efface_les_fichiers(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Pose", "video": video_mp4(), "miniature": image_png()},
                             format="multipart")
        demo = Demo.objects.get(pk=r.data["id"])
        chemins = [Path(demo.video.path), Path(demo.miniature.path)]
        self.assertTrue(all(c.exists() for c in chemins))
        self.assertEqual(self.client.delete(f"{URL_ADMIN}demos/{demo.id}/").status_code, 204)
        self.assertFalse(any(c.exists() for c in chemins))

    def test_retirer_la_video_quand_un_lien_existe(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Pose", "video": video_mp4(),
                                                    "lien": "https://youtu.be/dQw4w9WgXcQ"}, format="multipart")
        chemin = Path(Demo.objects.get(pk=r.data["id"]).video.path)
        r = self.client.patch(f"{URL_ADMIN}demos/{r.data['id']}/", {"video": None}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.data["video"])
        self.assertFalse(chemin.exists())

    def test_ville_du_temoignage_controlee(self):
        self.client.force_authenticate(creer_client())
        for ville in ("www.spam.cm", "moi@exemple.cm", "699811635 Douala"):
            with self.subTest(ville=ville):
                r = self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4, "ville": ville}, format="json")
                self.assertEqual(r.status_code, 400, r.content)
                self.assertIn("ville", r.data)
        r = self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4, "ville": "  Douala   Akwa "},
                             format="json")
        self.assertEqual((r.status_code, r.data["ville"]), (201, "Douala Akwa"))

    def test_jeton_lu_pour_mes_temoignages_et_le_depot(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer jeton-perime")
        self.assertEqual(self.client.get(f"{URL}temoignages/miens/").status_code, 401)
        self.assertEqual(self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 4},
                                          format="json").status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.get(f"{URL}temoignages/").status_code, 200)

    def test_demo_clean_dans_l_administration(self):
        from django.core.exceptions import ValidationError as ErreurModele
        for demo, champ in ((Demo(titre="Sans rien"), "video"),
                            (Demo(titre="Mauvais lien", lien="https://exemple.com/video"), "lien")):
            with self.subTest(champ=champ), self.assertRaises(ErreurModele) as contexte:
                demo.full_clean()
            self.assertIn(champ, contexte.exception.message_dict)
        Demo(titre="Bon", lien="https://vimeo.com/76979871").full_clean()
