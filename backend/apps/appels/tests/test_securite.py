"""Compléments du testeur : webhook JaaS (méthodes, en-têtes), droits, confidentialité des appels."""
import json
from unittest import mock

from apps.appels import services
from apps.appels.models import Appel
from apps.appels.tests.test_appels import ADMIN, URL, BaseAppels


class WebhookSecuriteTests(BaseAppels):
    def setUp(self):
        super().setUp()
        self.appel = Appel.objects.get(pk=self.appeler().data["appel"]["id"])
        services.repondre(self.membre, self.appel.pk)
        self.client.force_authenticate(None)
        self.corps = json.dumps({"eventType": "ROOM_DESTROYED", "fqn": f"app/{self.appel.salle}"})

    def poster(self, **entetes):
        return self.client.post(URL + "webhooks/jaas/", data=self.corps, content_type="application/json", **entetes)

    def test_bearer_accepte_et_secret_dans_l_url_ou_le_corps_ignore(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret"}):
            self.assertEqual(self.client.post(URL + "webhooks/jaas/?secret=s3cret", data=self.corps,
                                              content_type="application/json").status_code, 403)
            self.assertEqual(self.poster(HTTP_AUTHORIZATION="Bearer s3cretX").status_code, 403)
            self.appel.refresh_from_db()
            self.assertEqual(self.appel.etat, "en_cours")  # aucun effet tant que le secret est faux
            self.assertEqual(self.poster(HTTP_AUTHORIZATION="Bearer s3cret").status_code, 204)
        self.appel.refresh_from_db()
        self.assertEqual(self.appel.etat, "termine")

    def test_seule_la_methode_post_est_permise(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret"}):
            for methode in ("get", "put", "delete"):
                r = getattr(self.client, methode)(URL + "webhooks/jaas/", HTTP_X_WEBHOOK_SECRET="s3cret")
                self.assertEqual(r.status_code, 405, methode)

    def test_un_jeton_jwt_de_compte_ne_remplace_pas_le_secret(self):
        with mock.patch.dict("os.environ", {"JAAS_WEBHOOK_SECRET": "s3cret"}):
            self.client.force_authenticate(self.membre)
            self.assertEqual(self.poster().status_code, 403)


class ConfidentialiteTests(BaseAppels):
    def test_l_equipe_ne_peut_pas_lancer_d_appel_et_un_client_n_accede_pas_a_l_espace_equipe(self):
        self.se_connecter(self.membre)
        self.assertEqual(self.client.post(URL, {"type": "audio"}, format="json").status_code, 403)
        self.assertEqual(Appel.objects.count(), 0)
        self.se_connecter(self.client_a)
        for chemin in ("", "en-attente/", "usage/", "resume/"):
            self.assertEqual(self.client.get(ADMIN + chemin).status_code, 403, chemin)

    def test_le_jeton_du_client_est_celui_d_un_participant_et_la_salle_est_secrete(self):
        r = self.appeler()
        self.assertFalse(self.creer_jeton_mock.call_args.kwargs["moderateur"])
        self.assertRegex(r.data["jitsi"]["salle"], r"^cir-[0-9a-f]{24}$")
        self.se_connecter(self.client_b)
        # un autre client ne voit ni l'appel ni la salle
        self.assertEqual(self.client.get(f"{URL}{r.data['appel']['id']}/").status_code, 404)
        self.assertNotIn(r.data["jitsi"]["salle"], json.dumps(self.client.get(URL + "disponibilite/").data))

    def test_la_trame_en_direct_ne_va_qu_au_client_concerne_et_a_l_equipe(self):
        self.vider_publications()
        r = self.appeler()
        groupes = {g for g, t, d in self.publications if t in ("appel_entrant", "appel_mis_a_jour")}
        self.assertEqual(groupes, {"equipe"})
        self.vider_publications()
        self.se_connecter(self.membre)
        self.client.post(f"{ADMIN}{r.data['appel']['id']}/repondre/")
        groupes = {g for g, t, d in self.publications if t == "appel_mis_a_jour"}
        self.assertEqual(groupes, {"equipe", f"utilisateur_{self.client_a.pk}"})
        self.assertNotIn(f"utilisateur_{self.client_b.pk}", {g for g, _, _ in self.publications})

    def test_disponibilite_sans_nombre_exact(self):
        self.se_connecter(self.client_a)
        self.assertEqual(set(self.client.get(URL + "disponibilite/").data), {"configure", "equipe_en_ligne"})
