"""Outils communs aux tests de la vague 3 (messagerie, appels, notifications) : réseau et canaux toujours simulés."""
import shutil
import tempfile
from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.catalogue.tests.outils import MDP, MediasTemporairesMixin, creer_client, creer_membre  # noqa: F401
from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role
from apps.noyau import direct


class DirectCaptureMixin:
    """Remplace la publication Channels : les trames sont rangées dans `self.publications` (groupe, type, données),
    et publiées tout de suite (sans attendre la fin de la transaction du test)."""

    def setUp(self):
        super().setUp()
        self.publications = []
        for cible, remplacement in (
                (mock.patch.object(direct, "_envoyer", side_effect=lambda g, t, d: self.publications.append((g, t, d))),
                 None),
                (mock.patch.object(direct, "_apres_validation", side_effect=lambda f: f()), None)):
            cible.start()
            self.addCleanup(cible.stop)

    def trames(self, groupe=None, type=None):
        return [(g, t, d) for g, t, d in self.publications
                if (groupe is None or g == groupe) and (type is None or t == type)]

    def vider_publications(self):
        self.publications.clear()


def creer_membre_n(n, role=Role.MEMBRE):
    return Utilisateur.objects.create_user(f"equipe{n}@cir.cm", MDP, nom_complet=f"Membre {n}", role=role)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])  # tests plus rapides
class BaseVague3(DirectCaptureMixin, MediasTemporairesMixin, APITestCase):
    """Deux clients, un membre et un super-administrateur ; dossier privé temporaire ; canaux simulés."""

    def setUp(self):
        super().setUp()
        cache.clear()
        dossier = tempfile.mkdtemp(prefix="cir-prive-")
        self.addCleanup(shutil.rmtree, dossier, ignore_errors=True)
        reglage = override_settings(PRIVATE_ROOT=dossier)
        reglage.enable()
        self.addCleanup(reglage.disable)
        self.dossier_prive = dossier
        self.client_a = creer_client("a@exemple.cm", "Alice Client")
        self.client_b = creer_client("b@exemple.cm", "Bruno Client")
        self.membre = creer_membre()
        self.super_admin = Utilisateur.objects.create_user("super@cir.cm", MDP, nom_complet="Super Admin",
                                                           role=Role.SUPER_ADMIN)

    def se_connecter(self, utilisateur):
        self.client.force_authenticate(utilisateur)
