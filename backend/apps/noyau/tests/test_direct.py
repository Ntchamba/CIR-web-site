"""Publication en direct, présence et erreurs à code (aides communes de la vague 3)."""
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from rest_framework.exceptions import ErrorDetail, NotFound, ValidationError

from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role
from apps.noyau import direct, presence
from apps.noyau.erreurs import code_et_detail, conflit, indisponible, trop_de_demandes


class DirectTests(TestCase):
    def test_publier_utilisateur_envoie_a_son_groupe_apres_validation(self):
        with mock.patch.object(direct, "_envoyer") as envoyer:
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                direct.publier_utilisateur(7, "message", {"a": 1})
            envoyer.assert_not_called()  # rien ne part avant la validation de la transaction
            for callback in callbacks:
                callback()
            envoyer.assert_called_once_with("utilisateur_7", "message", {"a": 1})

    def test_publier_equipe(self):
        with mock.patch.object(direct, "_envoyer") as envoyer:
            with self.captureOnCommitCallbacks(execute=True):
                direct.publier_equipe("appel_entrant", {"x": 2})
            envoyer.assert_called_once_with("equipe", "appel_entrant", {"x": 2})

    def test_trame_et_groupe_reels(self):
        couche = mock.MagicMock()
        async def group_send(groupe, message):
            couche.envoye = (groupe, message)
        couche.group_send = group_send
        with mock.patch.object(direct, "get_channel_layer", return_value=couche):
            direct._envoyer("equipe", "lu", {"conversation": 3})
        self.assertEqual(couche.envoye, ("equipe", {"type": "direct.evenement",
                                                    "trame": {"type": "lu", "conversation": 3}}))

    def test_une_panne_du_canal_ne_propage_pas_l_erreur(self):
        with mock.patch.object(direct, "get_channel_layer", side_effect=RuntimeError("redis absent")):
            with self.assertLogs("cir.direct", level="ERROR"):
                direct._envoyer("equipe", "lu", {})  # ne lève rien

    def test_sans_couche_de_canaux_rien_ne_se_passe(self):
        with mock.patch.object(direct, "get_channel_layer", return_value=None):
            direct._envoyer("equipe", "lu", {})

    def test_compteurs_enregistres(self):
        utilisateur = Utilisateur(pk=1)
        with mock.patch.dict(direct._compteurs, {"messagerie": lambda u: 3, "notifications": lambda u: 5}):
            self.assertEqual(direct.compteurs(utilisateur), {"messagerie": 3, "notifications": 5})
            with mock.patch.object(direct, "_envoyer") as envoyer:
                with self.captureOnCommitCallbacks(execute=True):
                    direct.publier_compteurs(utilisateur)
            envoyer.assert_called_once_with("utilisateur_1", "non_lus", {"messagerie": 3, "notifications": 5})

    def test_un_compteur_en_panne_donne_zero(self):
        def casse(u):
            raise RuntimeError

        with mock.patch.dict(direct._compteurs, {"messagerie": casse}):
            with self.assertLogs("cir.direct", level="ERROR"):
                self.assertEqual(direct.compteurs(Utilisateur(pk=1))["messagerie"], 0)


class PresenceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.membre = Utilisateur.objects.create_user("m@cir.cm", "x", nom_complet="M", role=Role.MEMBRE)
        self.inactif = Utilisateur.objects.create_user("i@cir.cm", "x", nom_complet="I", role=Role.MEMBRE,
                                                       is_active=False)
        self.client_ = Utilisateur.objects.create_user("c@exemple.cm", "x", nom_complet="C")

    def test_personne_en_ligne(self):
        self.assertEqual(presence.equipe_en_ligne(), 0)
        self.assertFalse(presence.est_en_ligne(self.membre))

    def test_marquer_en_ligne(self):
        presence.marquer_en_ligne(self.membre)
        presence.marquer_en_ligne(self.membre)  # plusieurs onglets : un seul témoin
        self.assertTrue(presence.est_en_ligne(self.membre.pk))
        self.assertEqual(presence.equipe_en_ligne(), 1)

    def test_seule_l_equipe_active_compte(self):
        presence.marquer_en_ligne(self.client_)
        presence.marquer_en_ligne(self.inactif)
        self.assertEqual(presence.equipe_en_ligne(), 0)

    def test_ttl_de_90_secondes(self):
        with mock.patch.object(presence.cache, "set") as cache_set:
            presence.marquer_en_ligne(self.membre)
        cache_set.assert_called_once_with(f"presence:utilisateur:{self.membre.pk}", 1, 90)


class ErreursTests(TestCase):
    def test_erreurs_avec_code(self):
        for fabrique, statut in ((conflit, 409), (indisponible, 503), (trop_de_demandes, 429)):
            erreur = fabrique("Message", "mon_code")
            self.assertEqual(erreur.status_code, statut)
            self.assertEqual(code_et_detail(erreur), ("mon_code", "Message"))

    def test_code_d_une_erreur_de_champ(self):
        erreur = ValidationError({"texte": [ErrorDetail("Vide", code="message_vide")]})
        self.assertEqual(code_et_detail(erreur), ("message_vide", "Vide"))

    def test_erreur_simple(self):
        self.assertEqual(code_et_detail(NotFound("Introuvable"))[1], "Introuvable")
