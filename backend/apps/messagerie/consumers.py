"""WebSocket unique `/ws/` : messagerie, notifications et appels (décision 8).

Protocole (contrat de la vague 3) :
- **authentification par la première trame** `{"type": "authentifier", "jeton": "<JWT d'accès>"}`, jamais dans
  l'adresse (les adresses finissent dans les journaux). Sans elle dans les 5 secondes : fermeture 4401. Jeton invalide,
  expiré ou compte inactif : trame d'erreur puis fermeture 4401. Trame de plus de 16 Ko : fermeture 4413 ;
- client → serveur : `ping`, `envoyer`, `lu`, `ecrit` ; serveur → client : `pret`, `pong`, `message`, `lu`, `ecrit`,
  `non_lus`, `notification`, `appel_entrant`, `appel_mis_a_jour`, `erreur` (une erreur ne ferme pas la connexion) ;
- chaque connexion rejoint le groupe `utilisateur_<id>` ; l'équipe rejoint aussi `equipe`. Les autres modules publient
  par `apps.noyau.direct`, jamais directement.
"""
import asyncio
import json
import time

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import translation
from django.utils.translation import gettext as _
from rest_framework.exceptions import APIException, AuthenticationFailed, NotFound, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.noyau import direct, presence
from apps.noyau.erreurs import code_et_detail
from apps.noyau.langues import LANGUE_PAR_DEFAUT, code_court, code_django

from . import services

CODES_ERREUR = {"non_authentifie", "message_vide", "trop_long", "trop_de_messages", "conversation_inconnue",
                "interdit", "format_invalide"}
FERMETURE_NON_AUTHENTIFIE = 4401
FERMETURE_TROP_GROS = 4413


def _entier(valeur):
    """Entier strict (les booléens et les chaînes ne passent pas) ou None."""
    return valeur if isinstance(valeur, int) and not isinstance(valeur, bool) else None


@database_sync_to_async
def _utilisateur_du_jeton(jeton):
    """Compte actif correspondant au jeton d'accès, sinon None (jeton invalide, expiré, compte inactif)."""
    try:
        valide = AccessToken(jeton)
        utilisateur = JWTAuthentication().get_user(valide)
    except (TokenError, InvalidToken, AuthenticationFailed, KeyError, TypeError):
        return None
    return utilisateur if utilisateur.is_active else None


class ConsommateurDirect(AsyncWebsocketConsumer):
    DELAI_AUTHENTIFICATION = 5  # secondes
    TAILLE_MAX = 16 * 1024  # octets par trame
    INTERVALLE_ECRIT = 3  # secondes entre deux « est en train d'écrire »

    async def connect(self):
        self.utilisateur = None
        self.groupes = []
        self.derniere_ecriture = 0.0
        self.cle_erreur = None  # `cle_client` de la trame `envoyer` en cours : reprise dans ses erreurs
        self.langue = self._langue_de_la_requete()
        await self.accept()
        self.minuteur = asyncio.create_task(self._attendre_authentification())

    async def disconnect(self, code):
        minuteur = getattr(self, "minuteur", None)
        if minuteur is not None and minuteur is not asyncio.current_task():
            minuteur.cancel()
        for groupe in getattr(self, "groupes", []):
            await self.channel_layer.group_discard(groupe, self.channel_name)

    # --- Outils ---

    def _langue_de_la_requete(self):
        for nom, valeur in self.scope.get("headers", []):
            if nom == b"accept-language":
                premier = valeur.decode("latin-1").split(",")[0].split(";")[0].strip()
                return code_court(premier)
        return LANGUE_PAR_DEFAUT

    def _base_url(self):
        hote = ""
        for nom, valeur in self.scope.get("headers", []):
            if nom == b"host":
                hote = valeur.decode("latin-1")
        if not hote:
            return ""
        return f"{'https' if self.scope.get('scheme') == 'wss' else 'http'}://{hote}"

    async def _envoyer(self, trame):
        await self.send(text_data=json.dumps(trame, ensure_ascii=False))

    async def _erreur(self, code, detail=None):
        with translation.override(code_django(self.langue)):
            trame = {"type": "erreur", "code": code,
                     "detail": detail if detail is not None else _("Trame refusée.")}
            if self.cle_erreur:
                trame["cle_client"] = self.cle_erreur
            await self._envoyer(trame)

    async def _fermer(self, code):
        try:
            await self.close(code=code)
        except Exception:  # noqa: BLE001 - déjà fermée
            pass

    async def _attendre_authentification(self):
        await asyncio.sleep(self.DELAI_AUTHENTIFICATION)
        if self.utilisateur is None:
            await self._erreur("non_authentifie", self._texte_non_authentifie())
            await self._fermer(FERMETURE_NON_AUTHENTIFIE)

    def _texte_non_authentifie(self):
        with translation.override(code_django(self.langue)):
            return _("Connexion refusée : jeton absent, invalide ou expiré.")

    # --- Réception ---

    async def receive(self, text_data=None, bytes_data=None):
        brut = text_data if text_data is not None else (bytes_data or b"")
        taille = len(brut.encode("utf-8")) if isinstance(brut, str) else len(brut)
        if taille > self.TAILLE_MAX:
            await self._fermer(FERMETURE_TROP_GROS)
            return
        try:
            trame = json.loads(brut) if text_data is not None else None
        except ValueError:
            trame = None
        if not isinstance(trame, dict) or not isinstance(trame.get("type"), str):
            await self._erreur("format_invalide")
            return
        type_trame = trame["type"]
        if self.utilisateur is None:
            if type_trame != "authentifier":  # ordre des trames : l'authentification vient toujours en premier
                await self._erreur("non_authentifie", self._texte_non_authentifie())
                await self._fermer(FERMETURE_NON_AUTHENTIFIE)
                return
            await self._authentifier(trame)
            return
        with translation.override(code_django(self.utilisateur.langue)):
            gestionnaires = {"ping": self._ping, "envoyer": self._envoyer_message, "lu": self._lu,
                             "ecrit": self._ecrit}
            gestionnaire = gestionnaires.get(type_trame)
            if gestionnaire is None:
                await self._erreur("format_invalide")
                return
            cle = trame.get("cle_client")
            self.cle_erreur = cle if type_trame == "envoyer" and isinstance(cle, str) and cle else None
            try:
                await gestionnaire(trame)
            except APIException as erreur:
                await self._erreur_api(erreur)
            finally:
                self.cle_erreur = None

    async def _erreur_api(self, erreur):
        if isinstance(erreur, NotFound):
            code, detail = "conversation_inconnue", str(erreur.detail)
        elif isinstance(erreur, PermissionDenied):
            code, detail = "interdit", str(erreur.detail)
        else:
            code, detail = code_et_detail(erreur)
        trame = {"type": "erreur", "code": code if code in CODES_ERREUR else "format_invalide", "detail": detail}
        if self.cle_erreur:
            trame["cle_client"] = self.cle_erreur
        await self._envoyer(trame)

    async def _authentifier(self, trame):
        jeton = trame.get("jeton")
        utilisateur = await _utilisateur_du_jeton(jeton) if isinstance(jeton, str) and jeton else None
        if utilisateur is None:
            await self._erreur("non_authentifie", self._texte_non_authentifie())
            await self._fermer(FERMETURE_NON_AUTHENTIFIE)
            return
        self.utilisateur = utilisateur
        self.langue = code_court(utilisateur.langue)
        self.minuteur.cancel()
        self.groupes = [direct.groupe_utilisateur(utilisateur.pk)]
        if utilisateur.est_equipe:
            self.groupes.append(direct.GROUPE_EQUIPE)
        for groupe in self.groupes:
            await self.channel_layer.group_add(groupe, self.channel_name)
        await sync_to_async(presence.marquer_en_ligne, thread_sensitive=False)(utilisateur)
        valeurs = await database_sync_to_async(direct.compteurs)(utilisateur)
        await self._envoyer({"type": "pret", "utilisateur": {"id": utilisateur.pk, "role": utilisateur.role},
                             "non_lus": valeurs["messagerie"], "notifications_non_lues": valeurs["notifications"]})

    # --- Trames du client ---

    async def _ping(self, trame):
        await sync_to_async(presence.marquer_en_ligne, thread_sensitive=False)(self.utilisateur)
        await self._envoyer({"type": "pong"})

    async def _envoyer_message(self, trame):
        texte = trame.get("texte")
        if not isinstance(texte, str):
            await self._erreur("format_invalide")
            return
        commande, cle = trame.get("commande"), trame.get("cle_client", "")
        if (commande is not None and _entier(commande) is None) or not isinstance(cle, str):
            await self._erreur("format_invalide")
            return
        identifiant = trame.get("conversation")
        if identifiant is not None and _entier(identifiant) is None:
            await self._erreur("format_invalide")
            return
        if identifiant is not None and not self.utilisateur.est_equipe:
            propre = await database_sync_to_async(lambda: services.conversation_du_client(self.utilisateur).pk)()
            if identifiant != propre:
                await self._erreur("interdit", _("Accès interdit à cette conversation."))
                return
        base_url = self._base_url()
        await database_sync_to_async(self._envoyer_sync)(identifiant, texte, commande, cle, base_url)

    def _envoyer_sync(self, identifiant, texte, commande, cle, base_url):
        conversation = services.conversation_pour(self.utilisateur, identifiant)
        services.envoyer_message(conversation, self.utilisateur, texte=texte, commande=commande, cle_client=cle,
                                 base_url=base_url)

    async def _lu(self, trame):
        jusqu_a = _entier(trame.get("jusqu_a"))
        identifiant = trame.get("conversation")
        if jusqu_a is None or (identifiant is not None and _entier(identifiant) is None):
            await self._erreur("format_invalide")
            return

        def faire():
            conversation = services.conversation_pour(self.utilisateur, identifiant)
            services.marquer_lu(conversation, self.utilisateur, jusqu_a)

        await database_sync_to_async(faire)()

    async def _ecrit(self, trame):
        identifiant = trame.get("conversation")
        if identifiant is not None and _entier(identifiant) is None:
            await self._erreur("format_invalide")
            return
        maintenant = time.monotonic()
        if maintenant - self.derniere_ecriture < self.INTERVALLE_ECRIT:
            return  # au plus un toutes les 3 secondes : le reste est ignoré
        self.derniere_ecriture = maintenant

        def faire():
            conversation = services.conversation_pour(self.utilisateur, identifiant)
            services.signaler_ecriture(conversation, self.utilisateur)

        await database_sync_to_async(faire)()

    # --- Trames publiées par les modules (groupes Channels) ---

    async def direct_evenement(self, evenement):
        await self._envoyer(evenement["trame"])
