"""Règles de la vitrine : modération, intégration des vidéos, dépôt des témoignages."""
from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError

from apps.catalogue.tests.outils import creer_client, creer_membre
from apps.vitrine import moderation, services
from apps.vitrine.models import StatutTemoignage


class ModerationTexteTests(SimpleTestCase):
    def test_texte_accepte_et_nettoye(self):
        self.assertEqual(moderation.verifier_texte("  Très   beau sol,\n\n\n\nmerci au CIR !  "),
                         "Très beau sol,\n\nmerci au CIR !")

    def test_refus(self):
        for texte in ("Trop court", "x" * 801, "Super travail, voir https://exemple.com pour la suite",
                      "Très bon travail, allez sur www.exemple.cm merci", "Très bon travail, visitez monsite.com",
                      "Appelez-moi au +237 6 99 81 16 35 pour en parler", "Écrivez-moi : awa@exemple.cm merci beaucoup"):
            with self.subTest(texte=texte), self.assertRaises(ValidationError):
                moderation.verifier_texte(texte)


class IntegrationVideoTests(SimpleTestCase):
    def test_adresses(self):
        cas = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://vimeo.com/76979871": "https://player.vimeo.com/video/76979871",
            "https://player.vimeo.com/video/76979871": "https://player.vimeo.com/video/76979871",
            "https://exemple.com/video.mp4": None,
            "javascript:alert(1)": None,
            "https://www.youtube.com/watch?v=court": None,
            "": None,
        }
        for lien, attendu in cas.items():
            with self.subTest(lien=lien):
                self.assertEqual(services.adresse_integration(lien), attendu)


class DepotTemoignageTests(TestCase):
    TEXTE = "Un sol magnifique et très résistant, je recommande."

    def test_depot_client(self):
        client = creer_client(nom="Awa Test")
        t = services.deposer_temoignage(client, texte=self.TEXTE, note=5, ville=" Douala ")
        self.assertEqual((t.nom_affiche, t.ville, t.statut, t.langue), ("Awa Test", "Douala",
                                                                        StatutTemoignage.EN_ATTENTE, "fr"))

    def test_equipe_refusee(self):
        with self.assertRaises(PermissionDenied):
            services.deposer_temoignage(creer_membre(), texte=self.TEXTE, note=5)

    def test_quota_cinq_par_jour(self):
        client = creer_client()
        for _ in range(5):
            services.deposer_temoignage(client, texte=self.TEXTE, note=4)
        with self.assertRaises(Throttled):
            services.deposer_temoignage(client, texte=self.TEXTE, note=4)

    def test_publier_puis_refuser(self):
        membre = creer_membre()
        t = services.deposer_temoignage(creer_client(), texte=self.TEXTE, note=4)
        services.publier_temoignage(t, membre)
        self.assertEqual((t.statut, t.modere_par), (StatutTemoignage.PUBLIE, membre))
        services.refuser_temoignage(t, membre, "  Hors sujet ")
        self.assertEqual((t.statut, t.motif_refus), (StatutTemoignage.REFUSE, "Hors sujet"))
