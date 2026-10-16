"""API de la vitrine : publique (/api/vitrine/) et équipe (/api/admin/vitrine/)."""
import json

from rest_framework.test import APITestCase

from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MediasTemporairesMixin, creer_client, creer_membre, image_png, video_mp4
from apps.vitrine.models import Demo, Realisation, StatutTemoignage, Temoignage

URL = "/api/vitrine/"
URL_ADMIN = "/api/admin/vitrine/"
TEXTE = "Un sol magnifique et très résistant, je recommande."


class VitrinePublicTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        famille = Famille.objects.create(nom="Finitions")
        self.produit = Produit.objects.create(famille=famille, nom="Sol autolissant")
        self.cache = Produit.objects.create(famille=famille, nom="Caché", en_ligne=False)
        self.realisation = Realisation.objects.create(
            titre="Salon", type_chantier="maison", ville="Douala", image_apres=image_png(),
            traductions={"en": {"titre": "Living room"}})
        self.realisation.produits.set([self.produit, self.cache])
        Realisation.objects.create(titre="Usine", type_chantier="industrie", image_apres=image_png())
        Realisation.objects.create(titre="Brouillon", type_chantier="maison", image_apres=image_png(), publie=False)

    def test_realisations(self):
        r = self.client.get(f"{URL}realisations/")
        self.assertEqual(r.data["count"], 2)
        r = self.client.get(f"{URL}realisations/?type=maison", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.data["count"], 1)
        donnees = r.data["results"][0]
        self.assertEqual(donnees["titre"], "Living room")
        self.assertIsNone(donnees["image_avant"])
        self.assertTrue(donnees["image_apres"]["url"].startswith("http://testserver/media/"))
        self.assertEqual(donnees["image_apres"]["alt"], "Living room, after the work")
        self.assertEqual(donnees["produits"], [{"slug": self.produit.slug, "nom": "Sol autolissant"}])
        self.assertEqual(self.client.get(f"{URL}realisations/{self.realisation.slug}/").status_code, 200)
        self.assertEqual(self.client.get(f"{URL}realisations/brouillon/").status_code, 404)

    def test_demos(self):
        Demo.objects.create(titre="Pose", lien="https://youtu.be/dQw4w9WgXcQ", duree="1:45")
        Demo.objects.create(titre="Cachée", lien="https://youtu.be/dQw4w9WgXcQ", publie=False)
        r = self.client.get(f"{URL}demos/")
        self.assertEqual(r.data["count"], 1)
        demo = r.data["results"][0]
        self.assertEqual(demo["integration"], "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")
        self.assertIsNone(demo["video"])
        self.assertIsNone(demo["miniature"])

    def test_temoignages_publics_seulement_publies(self):
        Temoignage.objects.create(nom_affiche="A", texte=TEXTE, note=5, statut=StatutTemoignage.PUBLIE, langue="en")
        Temoignage.objects.create(nom_affiche="B", texte=TEXTE, note=4)
        r = self.client.get(f"{URL}temoignages/")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(set(r.data["results"][0]),
                         {"id", "nom_affiche", "ville", "type_chantier", "texte", "note", "langue", "date"})

    def test_depot_temoignage(self):
        donnees = {"texte": TEXTE, "note": 5, "ville": "Douala", "type_chantier": "maison"}
        self.assertEqual(self.client.post(f"{URL}temoignages/", donnees, format="json").status_code, 401)
        self.client.force_authenticate(creer_membre())
        self.assertEqual(self.client.post(f"{URL}temoignages/", donnees, format="json").status_code, 403)
        self.client.force_authenticate(creer_client(nom="Awa Test"))
        r = self.client.post(f"{URL}temoignages/", {**donnees, "nom_affiche": "Faux nom", "statut": "publie"},
                             format="json", HTTP_ACCEPT_LANGUAGE="de")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data["statut"], r.data["nom_affiche"], r.data["langue"]), ("en_attente", "Awa Test", "de"))
        self.assertEqual(self.client.get(f"{URL}temoignages/").data["count"], 0)
        r = self.client.post(f"{URL}temoignages/", {**donnees, "texte": "court"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("texte", r.data)
        r = self.client.post(f"{URL}temoignages/", {**donnees, "note": 6}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_quota_429(self):
        self.client.force_authenticate(creer_client())
        for _ in range(5):
            self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 5}, format="json")
        r = self.client.post(f"{URL}temoignages/", {"texte": TEXTE, "note": 5}, format="json")
        self.assertEqual(r.status_code, 429)

    def test_mes_temoignages(self):
        self.assertEqual(self.client.get(f"{URL}temoignages/miens/").status_code, 401)
        client = creer_client()
        Temoignage.objects.create(auteur=client, nom_affiche="A", texte=TEXTE, note=3,
                                  statut=StatutTemoignage.REFUSE, motif_refus="Hors sujet")
        Temoignage.objects.create(nom_affiche="Autre", texte=TEXTE, note=3)
        self.client.force_authenticate(client)
        r = self.client.get(f"{URL}temoignages/miens/")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual((r.data["results"][0]["statut"], r.data["results"][0]["motif_refus"]),
                         ("refuse", "Hors sujet"))


class VitrineEquipeTests(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.membre = creer_membre()
        self.client.force_authenticate(self.membre)
        famille = Famille.objects.create(nom="Finitions")
        self.produit = Produit.objects.create(famille=famille, nom="Sol autolissant")

    def test_acces_reserve(self):
        self.client.force_authenticate(creer_client())
        for route in ("realisations/", "demos/", "temoignages/"):
            self.assertEqual(self.client.get(f"{URL_ADMIN}{route}").status_code, 403)

    def test_realisation_multipart(self):
        r = self.client.post(f"{URL_ADMIN}realisations/", {
            "titre": "Salon", "type_chantier": "maison", "image_apres": image_png(),
            "produits": json.dumps([self.produit.id]), "traductions": json.dumps({"en": {"titre": "Living room"}}),
        }, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["produits"], [self.produit.id])
        self.assertTrue(r.data["image_apres"].startswith("http://testserver/media/vitrine/"))
        self.assertIn("langues_incompletes", r.data)
        rid = r.data["id"]
        r = self.client.patch(f"{URL_ADMIN}realisations/{rid}/", {"produits": []}, format="json")
        self.assertEqual(r.data["produits"], [])
        r = self.client.post(f"{URL_ADMIN}realisations/", {"titre": "Sans photo", "type_chantier": "maison"},
                             format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("image_apres", r.data)
        self.assertEqual(self.client.delete(f"{URL_ADMIN}realisations/{rid}/").status_code, 204)

    def test_demo_video_ou_lien(self):
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Sans rien"}, format="multipart")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Lien", "lien": "https://exemple.com/x"},
                             format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("lien", r.data)
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Fichier", "video": video_mp4(), "duree": "1:45"},
                             format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data["video"].endswith(".mp4"))
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Mauvais", "video": video_mp4("demo.avi")},
                             format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("video", r.data)
        r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Faux mp4", "video": image_png("faux.mp4")},
                             format="multipart")
        self.assertEqual(r.status_code, 400)

    def test_video_trop_lourde(self):
        from unittest import mock
        with mock.patch("apps.noyau.medias.VIDEO_OCTETS_MAX", 100):
            r = self.client.post(f"{URL_ADMIN}demos/", {"titre": "Lourde", "video": video_mp4(taille=200)},
                                 format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("video", r.data)

    def test_moderation(self):
        t = Temoignage.objects.create(auteur=creer_client(), nom_affiche="A", texte=TEXTE, note=4)
        Temoignage.objects.create(nom_affiche="B", texte=TEXTE, note=4, statut=StatutTemoignage.PUBLIE)
        r = self.client.get(f"{URL_ADMIN}temoignages/?statut=en_attente")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["auteur"]["email"], "client@exemple.cm")
        r = self.client.post(f"{URL_ADMIN}temoignages/{t.id}/publier/")
        self.assertEqual((r.status_code, r.data["statut"]), (200, "publie"))
        r = self.client.post(f"{URL_ADMIN}temoignages/{t.id}/refuser/", {"motif": "Hors sujet"}, format="json")
        self.assertEqual((r.data["statut"], r.data["motif_refus"]), ("refuse", "Hors sujet"))
        self.assertEqual(self.client.delete(f"{URL_ADMIN}temoignages/{t.id}/").status_code, 204)
