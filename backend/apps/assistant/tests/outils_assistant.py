"""Outils des tests de l'assistant : Gemini est TOUJOURS simulé (aucun appel réseau, aucune vraie clé)."""
import copy
import json
import os
from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.catalogue.models import Famille, Produit
from apps.catalogue.tests.outils import MDP, MediasTemporairesMixin, creer_client, creer_membre  # noqa: F401
from apps.comptes.models import Utilisateur
from apps.comptes.roles import Role
from integrations.gemini import client as client_gemini
from integrations.gemini.client import AppelOutil, Reponse

URL = "/api/assistant/"
ADMIN = "/api/admin/assistant/"
CLE_FICTIVE = "cle-de-test-fictive-0000"


def texte(contenu, entree=100, sortie=20, fin="STOP"):
    return Reponse(texte=contenu, appels=[], jetons_entree=entree, jetons_sortie=sortie, raison_fin=fin)


def appels(*demandes, entree=80, sortie=10):
    """Réponse du modèle qui demande des outils : demandes = (nom, {arguments})."""
    return Reponse(texte="", appels=[AppelOutil(nom=n, arguments=a) for n, a in demandes], jetons_entree=entree,
                   jetons_sortie=sortie, raison_fin="STOP")


class FauxGemini:
    """Remplace `integrations.gemini.client.generer` : file de réponses (ou d'exceptions), appels enregistrés."""

    def __init__(self):
        self.file = []
        self.appels = []

    def __call__(self, **demande):
        self.appels.append(copy.deepcopy(demande))
        assert isinstance(demande["delai"], (int, float)) and demande["delai"] > 0, "délai non positif"
        json.dumps(demande["messages"])  # contenu sérialisable en JSON (exigence de l'intégration)
        json.dumps(list(demande.get("outils") or ()))
        suivant = self.file.pop(0) if self.file else texte("Bonjour, je peux vous renseigner sur le catalogue.")
        if isinstance(suivant, Exception):
            raise suivant
        return suivant

    @property
    def tout_envoye(self):
        """Tout ce qui a été envoyé à Gemini (instruction, messages, déclarations), en une chaîne."""
        return json.dumps([{k: v for k, v in a.items()} for a in self.appels], ensure_ascii=False, default=str)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class BaseAssistant(MediasTemporairesMixin, APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.faux = FauxGemini()
        for patch in (mock.patch.dict(os.environ, {"GEMINI_API_KEY": CLE_FICTIVE}),
                      mock.patch.object(client_gemini, "generer", self.faux),
                      mock.patch("socket.socket", side_effect=AssertionError("appel réseau interdit"))):
            patch.start()
            self.addCleanup(patch.stop)
        self.famille = Famille.objects.create(nom="Sols autolissants", traductions={"en": {"nom": "Self-levelling"}})
        self.produit = Produit.objects.create(
            famille=self.famille, nom="Sol autolissant époxy", reference="YD-500", accroche="Sol lisse et brillant",
            description="Revêtement époxy pour sols industriels.", prix=18500, pour_industrie=True,
            traductions={"en": {"nom": "Epoxy self-levelling floor"}})
        self.sans_prix = Produit.objects.create(famille=self.famille, nom="Primaire époxy", reference="YD-103")
        self.hors_ligne = Produit.objects.create(famille=self.famille, nom="Produit caché", reference="ZZ-999",
                                                 en_ligne=False, prix=99999)
        self.client_a = creer_client("alice@exemple.cm", "Alice Ngono")
        self.client_a.telephone = "+237 699 11 22 33"
        self.client_a.save()
        self.client_b = creer_client("bruno@exemple.cm", "Bruno Essomba")
        self.membre = creer_membre()
        self.super_admin = Utilisateur.objects.create_user("super@cir.cm", MDP, nom_complet="Super Admin",
                                                           role=Role.SUPER_ADMIN)

    def se_connecter(self, utilisateur):
        self.client.force_authenticate(utilisateur)

    def poser(self, question="Bonjour", **plus):
        return self.client.post(URL + "messages/", {"texte": question, **plus}, format="json")

    def commande_de(self, client, montant=400_000, paye=100_000, etat="contrat_signe"):
        from apps.commandes.models import Commande
        from apps.commandes.tests.outils import creer_commande
        commande = creer_commande(client, self.produit)
        Commande.objects.filter(pk=commande.pk).update(etat=etat, montant_convenu=montant, montant_paye=paye)
        commande.refresh_from_db()
        return commande
