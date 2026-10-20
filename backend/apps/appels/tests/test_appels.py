"""Appels : règles métier, API client et équipe, expiration, verrou de réponse, usage JaaS, webhook."""
import json
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from apps.appels import salles, services
from apps.appels.models import Appel, EtatAppel
from apps.appels.signals import appel_manque
from apps.commandes.tests.outils import creer_commande
from apps.noyau import presence
from apps.noyau.tests.outils_direct import BaseVague3, creer_membre_n

URL = "/api/appels/"
ADMIN = "/api/admin/appels/"


class BaseAppels(BaseVague3):
    """Jitsi simulé : aucune clé, aucun réseau."""

    def setUp(self):
        super().setUp()
        for cible, valeur in (("configure", True),):
            p = mock.patch.object(salles.jetons, cible, return_value=valeur)
            p.start()
            self.addCleanup(p.stop)
        self.creer_jeton = mock.patch.object(salles.jetons, "creer_jeton", return_value="jeton-simule")
        self.creer_jeton_mock = self.creer_jeton.start()
        self.addCleanup(self.creer_jeton.stop)
        p = mock.patch.object(salles.jetons, "parametres_client", return_value={"domaine": "8x8.vc", "app_id": "app-test"})
        p.start()
        self.addCleanup(p.stop)
        presence.marquer_en_ligne(self.membre)

    def appeler(self, utilisateur=None, **donnees):
        self.se_connecter(utilisateur or self.client_a)
        return self.client.post(URL, {"type": "audio", **donnees}, format="json")

    def vieillir(self, appel, secondes):
        Appel.objects.filter(pk=appel.pk).update(cree_le=timezone.now() - timedelta(seconds=secondes))


class LancerTests(BaseAppels):
    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(URL, {"type": "audio"}, format="json").status_code, 401)
        self.se_connecter(self.membre)  # l'équipe n'appelle pas un client, ni ne lance d'appel
        r = self.client.post(URL, {"type": "audio"}, format="json")
        self.assertEqual((r.status_code, r.data["code"]), (403, "compte_equipe"))

    def test_appel_reussi(self):
        r = self.appeler(type="video")
        self.assertEqual(r.status_code, 201, r.content)
        appel = r.data["appel"]
        self.assertRegex(appel["reference"], r"^APP-\d{4}-0001$")
        self.assertEqual((appel["etat"], appel["type"], appel["repondu_par"], appel["duree_secondes"]),
                         ("sonne", "video", None, None))
        self.assertEqual(appel["client"]["id"], self.client_a.pk)
        jitsi = r.data["jitsi"]
        self.assertEqual((jitsi["domaine"], jitsi["app_id"], jitsi["jeton"]), ("8x8.vc", "app-test", "jeton-simule"))
        self.assertRegex(jitsi["salle"], r"^cir-[0-9a-f]{24}$")
        # jeton de participant, non modérateur
        noms = self.creer_jeton_mock.call_args.kwargs
        self.assertFalse(noms["moderateur"])
        self.assertEqual(noms["salle"], jitsi["salle"])
        # sonnerie de l'équipe en direct
        entrant = self.trames("equipe", "appel_entrant")
        self.assertEqual(entrant[0][2]["appel"]["id"], appel["id"])

    def test_salles_aleatoires_et_jamais_reutilisees(self):
        salles_vues = {salles.nouvelle_salle() for _ in range(200)}
        self.assertEqual(len(salles_vues), 200)

    def test_type_invalide(self):
        self.assertEqual(self.appeler(type="fax").status_code, 400)

    def test_jitsi_non_configure_503(self):
        with mock.patch.object(salles.jetons, "configure", return_value=False):
            r = self.appeler()
        self.assertEqual((r.status_code, r.data["code"]), (503, "appels_non_configures"))
        self.assertEqual(Appel.objects.count(), 0)

    def test_un_seul_appel_actif_par_client(self):
        self.appeler()
        r = self.appeler()
        self.assertEqual((r.status_code, r.data["code"]), (409, "appel_deja_en_cours"))
        self.assertEqual(self.appeler(self.client_b).status_code, 201)  # un autre client peut appeler

    def test_equipe_indisponible(self):
        from django.core.cache import cache

        cache.clear()
        r = self.appeler()
        self.assertEqual((r.status_code, r.data["code"]), (409, "equipe_indisponible"))
        self.assertEqual(Appel.objects.count(), 0)

    def test_quota_de_5_appels_par_heure(self):
        for _ in range(5):
            r = self.appeler()
            self.assertEqual(r.status_code, 201)
            self.client.post(f"{URL}{r.data['appel']['id']}/annuler/")
        r = self.appeler()
        self.assertEqual(r.status_code, 429)
        Appel.objects.update(cree_le=timezone.now() - timedelta(hours=2))
        self.assertEqual(self.appeler().status_code, 201)

    def test_commande_du_client_seulement(self):
        from apps.catalogue.models import Famille, Produit

        produit = Produit.objects.create(famille=Famille.objects.create(nom="F"), nom="Sol")
        mienne, autre = creer_commande(self.client_a, produit), creer_commande(self.client_b, produit)
        self.assertEqual(self.appeler(commande=autre.pk).status_code, 400)
        r = self.appeler(commande=mienne.pk)
        self.assertEqual(r.data["appel"]["commande"], {"id": mienne.pk, "reference": mienne.reference})

    def test_disponibilite(self):
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(URL + "disponibilite/").data, {"configure": True, "equipe_en_ligne": True})
        from django.core.cache import cache

        cache.clear()
        with mock.patch.object(salles.jetons, "configure", return_value=False):
            self.assertEqual(self.client.get(URL + "disponibilite/").data,
                             {"configure": False, "equipe_en_ligne": False})


class CycleDeVieClientTests(BaseAppels):
    def setUp(self):
        super().setUp()
        self.appel = Appel.objects.get(pk=self.appeler().data["appel"]["id"])

    def test_etat_actuel(self):
        r = self.client.get(f"{URL}{self.appel.pk}/")
        self.assertEqual(r.data["appel"]["etat"], "sonne")

    def test_appel_d_un_autre_client_404(self):
        self.se_connecter(self.client_b)
        for chemin in ("", "annuler/", "terminer/"):
            lecture = self.client.get(f"{URL}{self.appel.pk}/{chemin}") if not chemin else \
                self.client.post(f"{URL}{self.appel.pk}/{chemin}")
            self.assertEqual(lecture.status_code, 404, chemin)

    def test_annuler_pendant_la_sonnerie(self):
        r = self.client.post(f"{URL}{self.appel.pk}/annuler/")
        self.assertEqual(r.data["appel"]["etat"], "annule")
        self.assertEqual(self.client.post(f"{URL}{self.appel.pk}/annuler/").status_code, 400)
        self.assertTrue(self.trames("equipe", "appel_mis_a_jour"))
        self.assertEqual(self.appeler().status_code, 201)  # libère le client

    def test_terminer_exige_un_appel_en_cours(self):
        self.assertEqual(self.client.post(f"{URL}{self.appel.pk}/terminer/").status_code, 400)
        services.repondre(self.membre, self.appel.pk)
        self.se_connecter(self.client_a)
        r = self.client.post(f"{URL}{self.appel.pk}/terminer/")
        self.assertEqual(r.data["appel"]["etat"], "termine")
        self.assertIsNotNone(r.data["appel"]["duree_secondes"])

    def test_expiration_a_60_secondes_a_la_lecture(self):
        self.vieillir(self.appel, 59)
        self.assertEqual(self.client.get(f"{URL}{self.appel.pk}/").data["appel"]["etat"], "sonne")
        self.vieillir(self.appel, 61)
        with mock.patch.object(appel_manque, "send") as signal:
            r = self.client.get(f"{URL}{self.appel.pk}/")
        self.assertEqual(r.data["appel"]["etat"], "manque")
        signal.assert_called_once()
        self.assertEqual(self.client.get(f"{URL}{self.appel.pk}/").data["appel"]["etat"], "manque")  # une seule fois

    def test_expiration_a_la_nouvelle_demande(self):
        self.vieillir(self.appel, 120)
        self.assertEqual(self.appeler().status_code, 201)
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, "manque")

    def test_expiration_par_la_commande(self):
        self.vieillir(self.appel, 90)
        sortie = StringIO()
        call_command("expirer_appels", stdout=sortie)
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, "manque")
        self.assertIn("1 appel", sortie.getvalue())

    def test_appel_en_cours_oublie_termine_apres_3_heures(self):
        services.repondre(self.membre, self.appel.pk)
        Appel.objects.filter(pk=self.appel.pk).update(demarre_le=timezone.now() - timedelta(hours=4))
        self.assertEqual(services.expirer_appels(), 1)
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, "termine")


class EquipeTests(BaseAppels):
    def setUp(self):
        super().setUp()
        self.autre_membre = creer_membre_n(2)
        self.appel = Appel.objects.get(pk=self.appeler().data["appel"]["id"])
        self.se_connecter(self.membre)
        self.vider_publications()

    def test_acces_reserve_a_l_equipe(self):
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(ADMIN).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(ADMIN + "en-attente/").status_code, 401)

    def test_en_attente(self):
        r = self.client.get(ADMIN + "en-attente/")
        self.assertEqual([a["id"] for a in r.data], [self.appel.pk])
        self.vieillir(self.appel, 100)
        self.assertEqual(self.client.get(ADMIN + "en-attente/").data, [])  # expiré : n'est plus à sonner

    def test_repondre_donne_un_jeton_moderateur(self):
        r = self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["appel"]["etat"], "en_cours")
        self.assertEqual(r.data["appel"]["repondu_par"]["id"], self.membre.pk)
        self.assertEqual(r.data["jitsi"]["jeton"], "jeton-simule")
        self.assertTrue(self.creer_jeton_mock.call_args.kwargs["moderateur"])
        self.assertEqual(self.creer_jeton_mock.call_args.kwargs["utilisateur_id"], self.membre.pk)
        # le client et toute l'équipe sont prévenus
        self.assertTrue(self.trames(f"utilisateur_{self.client_a.pk}", "appel_mis_a_jour"))
        self.assertEqual(self.trames("equipe", "appel_mis_a_jour")[0][2]["appel"]["etat"], "en_cours")

    def test_le_premier_qui_repond_gagne(self):
        self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        self.se_connecter(self.autre_membre)
        r = self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        self.assertEqual((r.status_code, r.data["code"]), (409, "appel_pris"))
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.repondu_par_id, self.membre.pk)

    def test_le_meme_membre_peut_rejoindre(self):
        self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        r = self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        self.assertEqual((r.status_code, r.data["appel"]["etat"]), (200, "en_cours"))

    def test_repondre_a_un_appel_manque_ou_annule(self):
        self.vieillir(self.appel, 100)
        r = self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        self.assertEqual((r.status_code, r.data["code"]), (409, "appel_indisponible"))
        self.assertEqual(self.client.post(f"{ADMIN}9999/repondre/").status_code, 404)

    def test_refuser(self):
        r = self.client.post(f"{ADMIN}{self.appel.pk}/refuser/")
        self.assertEqual(r.data["appel"]["etat"], "refuse")
        self.assertEqual(self.client.post(f"{ADMIN}{self.appel.pk}/refuser/").status_code, 409)
        self.se_connecter(self.autre_membre)
        self.assertEqual(self.client.post(f"{ADMIN}{self.appel.pk}/repondre/").data["code"], "appel_pris")

    def test_terminer(self):
        self.assertEqual(self.client.post(f"{ADMIN}{self.appel.pk}/terminer/").status_code, 400)
        self.client.post(f"{ADMIN}{self.appel.pk}/repondre/")
        r = self.client.post(f"{ADMIN}{self.appel.pk}/terminer/")
        self.assertEqual(r.data["appel"]["etat"], "termine")

    def test_historique_manques_en_tete_avec_rappel(self):
        termine = Appel.objects.create(client=self.client_b, type="audio", salle=salles.nouvelle_salle(),
                                       etat="termine")
        self.vieillir(self.appel, 100)
        r = self.client.get(ADMIN)
        self.assertEqual([a["id"] for a in r.data["results"]], [self.appel.pk, termine.pk])
        manque, autre = r.data["results"]
        self.assertEqual(manque["rappel"], {"telephone": "", "lien_messagerie": f"/messagerie?client={self.client_a.pk}"})
        self.assertIsNone(autre["rappel"])
        self.assertEqual([a["id"] for a in self.client.get(ADMIN + "?etat=termine").data["results"]], [termine.pk])
        self.assertEqual(self.client.get(ADMIN + "?search=bruno").data["count"], 1)

    def test_resume_et_manques_vus(self):
        self.assertEqual(self.client.get(ADMIN + "resume/").data, {"en_attente": 1, "manques_non_vus": 0})
        self.vieillir(self.appel, 100)
        self.assertEqual(self.client.get(ADMIN + "resume/").data, {"en_attente": 0, "manques_non_vus": 1})
        self.client.get(ADMIN)  # l'équipe ouvre la liste
        self.assertEqual(self.client.get(ADMIN + "resume/").data, {"en_attente": 0, "manques_non_vus": 0})

    def test_usage_jaas(self):
        with override_settings(JAAS_LIMITE_GRATUITE=5):
            r = self.client.get(ADMIN + "usage/")
            self.assertEqual(r.data["utilisateurs_actifs"], 0)
            maintenant = timezone.now()
            for i, etat in enumerate(["en_cours", "termine", "termine", "manque", "annule"]):
                client = self.client_a if i < 2 else self.client_b  # deux clients distincts seulement
                Appel.objects.create(client=client, type="audio", salle=salles.nouvelle_salle(), etat=etat,
                                     demarre_le=maintenant if etat in ("en_cours", "termine") else None)
            ancien = Appel.objects.create(client=self.super_admin, type="audio", salle=salles.nouvelle_salle(),
                                          etat="termine", demarre_le=maintenant - timedelta(days=62))
            self.assertIsNotNone(ancien.pk)
            r = self.client.get(ADMIN + "usage/")
            self.assertEqual(r.data, {"mois": timezone.localtime().strftime("%Y-%m"), "utilisateurs_actifs": 2,
                                      "limite_gratuite": 5, "configure": True, "depasse": False, "proche": False})
        with override_settings(JAAS_LIMITE_GRATUITE=2):
            r = self.client.get(ADMIN + "usage/")
            self.assertEqual((r.data["proche"], r.data["depasse"]), (True, False))
        with override_settings(JAAS_LIMITE_GRATUITE=1):
            self.assertTrue(self.client.get(ADMIN + "usage/").data["depasse"])

    def test_seuil_de_80_pour_cent(self):
        with override_settings(JAAS_LIMITE_GRATUITE=25):
            for n, attendu in ((19, False), (20, True)):
                with mock.patch.object(services.Appel.objects, "filter") as f:
                    f.return_value.values.return_value.distinct.return_value.count.return_value = n
                    self.assertEqual(services.usage()["proche"], attendu)


class WebhookTests(BaseAppels):
    def setUp(self):
        super().setUp()
        self.appel = Appel.objects.get(pk=self.appeler().data["appel"]["id"])
        self.client.force_authenticate(None)

    def corps(self, type_, salle=None):
        return json.dumps({"eventType": type_, "fqn": f"app-test/{salle or self.appel.salle}",
                           "data": {"participantId": "p1"}})

    def envoyer(self, corps, secret=None):
        entetes = {"HTTP_X_WEBHOOK_SECRET": secret} if secret else {}
        return self.client.post(URL + "webhooks/jaas/", data=corps, content_type="application/json", **entetes)

    def test_secret_non_configure_503(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": ""}):
            self.assertEqual(self.envoyer(self.corps("ROOM_DESTROYED"), "x").status_code, 503)

    def test_secret_faux_ou_absent_403(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "le-bon-secret"}):
            self.assertEqual(self.envoyer(self.corps("ROOM_DESTROYED"), "mauvais").status_code, 403)
            self.assertEqual(self.envoyer(self.corps("ROOM_DESTROYED")).status_code, 403)

    def test_utilise_la_verification_en_temps_constant_de_l_integration(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s"}), \
                mock.patch.object(salles.webhooks, "verifier", return_value=True) as verifier:
            self.assertEqual(self.envoyer(self.corps("ROOM_CREATED"), "s").status_code, 204)
        verifier.assert_called_once()

    def test_salle_detruite_termine_l_appel_en_cours(self):
        services.repondre(self.membre, self.appel.pk)
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s"}):
            self.assertEqual(self.envoyer(self.corps("ROOM_DESTROYED"), "s").status_code, 204)
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, "termine")

    def test_un_participant_qui_entre_ne_fait_pas_passer_un_appel_qui_sonne_en_cours(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s"}):
            self.envoyer(self.corps("PARTICIPANT_JOINED"), "s")
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, EtatAppel.SONNE)

    def test_evenements_inconnus_et_salles_inconnues_ignores(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s"}):
            self.assertEqual(self.envoyer(self.corps("AUTRE_CHOSE"), "s").status_code, 204)
            self.assertEqual(self.envoyer(self.corps("ROOM_DESTROYED", "cir-inconnue00000000"), "s").status_code, 204)
            self.assertEqual(self.envoyer("pas du json", "s").status_code, 204)
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, "sonne")
