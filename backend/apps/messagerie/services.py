"""Règles métier de la messagerie. Les vues, le WebSocket et les sérialiseurs ne font qu'appeler ces fonctions.

Un message est enregistré, puis diffusé en direct (après validation de la transaction) à la conversation du client et
à toute l'équipe. Le signal `message_cree` prévient `notifications` (qui n'est jamais importé ici).
"""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, F, OuterRef, Q, Subquery
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ErrorDetail, NotFound, PermissionDenied, ValidationError

from apps.commandes.models import Commande
from apps.comptes.models import Utilisateur
from apps.noyau import direct
from apps.noyau.erreurs import trop_de_demandes
from apps.noyau.verrous import verrouiller_compte

from . import pieces_jointes, signals
from .models import TEXTE_MAX, Conversation, Message, PieceJointe, RoleAuteur

QUOTA_MESSAGES_PAR_MINUTE = 30
TAILLE_PAR_DEFAUT = 30
TAILLE_MAX = 100
CLIENT, EQUIPE = RoleAuteur.CLIENT.value, RoleAuteur.EQUIPE.value


def role_de(utilisateur):
    return EQUIPE if utilisateur.est_equipe else CLIENT


# --- Conversations ---

def conversation_du_client(client):
    """La conversation du client, créée à la demande (une seule par client)."""
    conversation, _cree = Conversation.objects.get_or_create(client=client)
    return conversation


def ouvrir_conversation(client_id):
    """Équipe : ouvre (ou retrouve) la conversation d'un compte client. Renvoie (conversation, créée)."""
    client = Utilisateur.objects.clients().filter(pk=client_id, is_active=True).first()
    if client is None:
        raise ValidationError({"client": [_("Ce compte client est introuvable.")]})
    try:
        with transaction.atomic():
            return Conversation.objects.get_or_create(client=client)
    except IntegrityError:  # création simultanée
        return Conversation.objects.get(client=client), False


def conversation_pour(utilisateur, conversation_id=None):
    """Conversation à laquelle `utilisateur` a droit : la sienne (client) ou celle demandée (équipe).

    404 si elle n'existe pas ; un client ne peut jamais viser la conversation d'un autre.
    """
    if utilisateur.est_equipe:
        conversation = Conversation.objects.select_related("client").filter(pk=conversation_id).first() \
            if conversation_id else None
        if conversation is None:
            raise NotFound(_("Conversation introuvable."))
        return conversation
    conversation = conversation_du_client(utilisateur)
    if conversation_id and int(conversation_id) != conversation.pk:
        raise NotFound(_("Conversation introuvable."))
    return conversation


def conversations_equipe(parametres):
    """Liste de l'équipe : dernier message, non lus ; ?non_lus=1 ?search= (nom, e-mail, téléphone du client)."""
    dernier = Message.objects.filter(conversation=OuterRef("pk")).order_by("-id")
    qs = (Conversation.objects.select_related("client")
          .annotate(non_lus=Count("messages", filter=Q(messages__auteur_role=CLIENT, messages__lu_le__isnull=True)),
                    apercu_texte=Subquery(dernier.values("texte")[:1]),
                    apercu_role=Subquery(dernier.values("auteur_role")[:1]),
                    apercu_date=Subquery(dernier.values("cree_le")[:1])))
    if parametres.get("non_lus", "").strip() in ("1", "true", "vrai"):
        qs = qs.filter(non_lus__gt=0)
    recherche = parametres.get("search", "").strip()
    if recherche:
        qs = qs.filter(Q(client__nom_complet__icontains=recherche) | Q(client__email__icontains=recherche)
                       | Q(client__telephone__icontains=recherche))
    return qs.order_by(F("dernier_message_le").desc(nulls_last=True), "-id")


# --- Lecture des messages ---

def messages_de(conversation):
    return (Message.objects.filter(conversation=conversation)
            .select_related("auteur", "commande").prefetch_related("pieces_jointes"))


def _entier(valeur, defaut=None):
    try:
        return int(valeur)
    except (TypeError, ValueError):
        return defaut


def page_messages(conversation, parametres):
    """`?avant=<id>` (historique), `?apres=<id>` (rattrapage), `?taille=` (30 par défaut, 100 au plus).

    Renvoie (messages du plus ancien au plus récent, a_plus) : `a_plus` dit s'il en reste dans la direction demandée.
    """
    taille = min(max(_entier(parametres.get("taille"), TAILLE_PAR_DEFAUT), 1), TAILLE_MAX)
    qs = messages_de(conversation)
    apres = _entier(parametres.get("apres"))
    if apres is not None:
        lot = list(qs.filter(id__gt=apres).order_by("id")[: taille + 1])
        return lot[:taille], len(lot) > taille
    avant = _entier(parametres.get("avant"))
    if avant is not None:
        qs = qs.filter(id__lt=avant)
    lot = list(qs.order_by("-id")[: taille + 1])
    return list(reversed(lot[:taille])), len(lot) > taille


# --- Compteurs ---

def non_lus_client(client):
    return Message.objects.filter(conversation__client=client, auteur_role=EQUIPE, lu_le__isnull=True).count()


def non_lus_equipe():
    return Message.objects.filter(auteur_role=CLIENT, lu_le__isnull=True).count()


def compteur_non_lus(utilisateur):
    """Pastille « messages non lus » d'un utilisateur (enregistrée dans `noyau.direct`)."""
    return non_lus_equipe() if utilisateur.est_equipe else non_lus_client(utilisateur)


def resume_equipe():
    """Pastille du menu de l'équipe."""
    non_lus = Message.objects.filter(auteur_role=CLIENT, lu_le__isnull=True)
    return {"non_lus_total": non_lus.count(), "conversations_non_lues": non_lus.values("conversation").distinct().count()}


def _pousser_compteurs(conversation, equipe_aussi=True):
    """Met à jour les pastilles du client et de chaque membre de l'équipe."""
    direct.publier_compteurs(conversation.client)
    if equipe_aussi:
        for membre in Utilisateur.objects.equipe().filter(is_active=True):
            direct.publier_compteurs(membre)


# --- Envoi ---

def _texte(valeur):
    texte = str(valeur or "").replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    return texte.strip()


def _verifier_quota(auteur):
    verrouiller_compte(auteur)  # deux envois simultanés du même compte passent l'un après l'autre
    depuis = timezone.now() - timedelta(minutes=1)
    if Message.objects.filter(auteur=auteur, cree_le__gte=depuis).count() >= QUOTA_MESSAGES_PAR_MINUTE:
        raise trop_de_demandes(_("Vous envoyez trop de messages à la fois : patientez une minute."),
                               "trop_de_messages")


def _pieces_a_rattacher(auteur, ids, fichiers):
    """Pièces déjà envoyées (ids) et fichiers reçus avec le message, 3 au plus au total."""
    fichiers = list(fichiers or [])
    ids = list(dict.fromkeys(ids or []))
    if len(ids) + len(fichiers) > pieces_jointes.PAR_MESSAGE_MAX:
        raise ValidationError({"fichiers": [_("Trois pièces jointes au plus par message.")]})
    existantes = []
    if ids:
        existantes = list(PieceJointe.objects.filter(pk__in=ids, proprietaire=auteur, message__isnull=True))
        if len(existantes) != len(ids):  # pièce inconnue, déjà utilisée ou d'un autre compte
            raise ValidationError({"pieces_jointes": [_("Une des pièces jointes est introuvable.")]})
    for fichier in fichiers:  # contrôle de TOUS les fichiers avant d'en écrire un seul
        pieces_jointes.preparer(fichier)
    return existantes, fichiers


def _commande_du_client(conversation, commande_id):
    if commande_id in (None, ""):
        return None
    commande = Commande.objects.filter(pk=_entier(commande_id, -1), client_id=conversation.client_id).first()
    if commande is None:
        raise ValidationError({"commande": [_("Commande introuvable.")]})
    return commande


def envoyer_message(conversation, auteur, *, texte="", commande=None, cle_client="", pieces_ids=(), fichiers=(),
                    base_url=""):
    """Enregistre un message de `auteur` dans `conversation` et le diffuse en direct.

    Renvoie (message, créé). Un envoi rejoué avec la même `cle_client` renvoie le message déjà enregistré
    (créé = False). `base_url` : adresse de l'API pour les liens des pièces jointes (vide : chemins relatifs).
    """
    role = role_de(auteur)
    if role == CLIENT and conversation.client_id != auteur.pk:
        raise PermissionDenied(_("Accès interdit à cette conversation."))
    cle_client = str(cle_client or "").strip()
    if len(cle_client) > 64:
        raise ValidationError({"cle_client": [_("Identifiant d'envoi trop long (64 caractères au plus).")]})
    if cle_client:
        existant = messages_de(conversation).filter(cle_client=cle_client).first()
        if existant is not None:
            return existant, False
    texte = _texte(texte)
    if len(texte) > TEXTE_MAX:
        raise ValidationError({"texte": [ErrorDetail(_("Le message est trop long (%(max)s caractères au plus).")
                                                     % {"max": TEXTE_MAX}, code="trop_long")]})
    existantes, nouveaux = _pieces_a_rattacher(auteur, pieces_ids, fichiers)
    if not texte and not existantes and not nouveaux:
        raise ValidationError({"texte": [ErrorDetail(_("Écrivez un message ou joignez un fichier."),
                                                     code="message_vide")]})
    ecrites = []
    try:
        with transaction.atomic():
            _verifier_quota(auteur)
            commande_liee = _commande_du_client(conversation, commande)
            message = Message.objects.create(conversation=conversation, auteur=auteur, auteur_role=role, texte=texte,
                                             commande=commande_liee, cle_client=cle_client)
            for piece in existantes:
                piece.message = message
                piece.save(update_fields=["message"])
            for fichier in nouveaux:
                piece = pieces_jointes.enregistrer(fichier, auteur)
                ecrites.append(piece)
                piece.message = message
                piece.save(update_fields=["message"])
            Conversation.objects.filter(pk=conversation.pk).update(dernier_message_le=message.cree_le)
            conversation.dernier_message_le = message.cree_le
            signals.message_cree.send(sender=Message, message=message)
            _diffuser(message, base_url)
    except IntegrityError:
        for piece in ecrites:
            piece.fichier.storage.delete(piece.fichier.name)
        existant = messages_de(conversation).filter(cle_client=cle_client).first() if cle_client else None
        if existant is None:
            raise
        return existant, False
    except Exception:
        for piece in ecrites:  # le fichier écrit hors transaction ne doit pas rester orphelin
            piece.fichier.storage.delete(piece.fichier.name)
        raise
    return messages_de(conversation).get(pk=message.pk), True


def _diffuser(message, base_url):
    """Message en direct : au client de la conversation et à toute l'équipe, puis les pastilles de chacun."""
    from .serializers import message_en_dict

    donnees = {"message": message_en_dict(Message.objects.select_related("auteur", "commande")
                                          .prefetch_related("pieces_jointes").get(pk=message.pk), base_url)}
    conversation = message.conversation
    direct.publier_utilisateur(conversation.client_id, "message", donnees)
    direct.publier_equipe("message", donnees)
    _pousser_compteurs(conversation)


def telecharger_piece(utilisateur, piece_id):
    """Pièce jointe visible par `utilisateur` (client de la conversation ou équipe), sinon 404."""
    piece = PieceJointe.objects.select_related("message__conversation").filter(pk=piece_id).first()
    if piece is None:
        raise NotFound(_("Fichier introuvable."))
    if piece.message_id is None:
        autorise = piece.proprietaire_id == utilisateur.pk  # avant l'envoi : seulement son auteur
    elif utilisateur.est_equipe:
        autorise = True
    else:
        autorise = piece.message.conversation.client_id == utilisateur.pk
    if not autorise:
        raise NotFound(_("Fichier introuvable."))
    return piece


def envoyer_piece(utilisateur, fichier):
    """`POST pieces-jointes/` : un fichier contrôlé et stocké en privé, rattaché ensuite à un message."""
    pieces_jointes.verifier_quota_non_rattachees(utilisateur)
    return pieces_jointes.enregistrer(fichier, utilisateur, champ="fichier")


# --- Lecture (accusés) ---

@transaction.atomic
def marquer_lu(conversation, lecteur, jusqu_a):
    """Marque lus les messages de l'AUTRE partie jusqu'à l'identifiant `jusqu_a`. Renvoie le nombre de non lus du lecteur."""
    jusqu_a = _entier(jusqu_a)
    if jusqu_a is None or jusqu_a < 0:
        raise ValidationError({"jusqu_a": [_("Indiquez l'identifiant du dernier message lu.")]})
    role = role_de(lecteur)
    autre = EQUIPE if role == CLIENT else CLIENT
    modifies = Message.objects.filter(conversation=conversation, auteur_role=autre, lu_le__isnull=True,
                                      id__lte=jusqu_a).update(lu_le=timezone.now())
    if modifies:
        dernier = jusqu_a
        # Accusé de lecture : l'autre partie voit « Lu » (le client est prévenu directement, l'équipe en bloc)
        trame = {"conversation": conversation.pk, "par": role, "jusqu_a": dernier}
        if role == CLIENT:
            direct.publier_equipe("lu", trame)
        else:
            direct.publier_utilisateur(conversation.client_id, "lu", trame)
            direct.publier_equipe("lu", trame)  # les autres membres de l'équipe voient la conversation lue
        signals.messages_lus.send(sender=Conversation, conversation=conversation, role_lecteur=role)
        _pousser_compteurs(conversation)
    return compteur_non_lus(lecteur) if role == EQUIPE else non_lus_client(lecteur)


def signaler_ecriture(conversation, auteur):
    """« est en train d'écrire » : prévient l'autre partie."""
    role = role_de(auteur)
    trame = {"conversation": conversation.pk, "par": role}
    if role == CLIENT:
        direct.publier_equipe("ecrit", trame)
    else:
        direct.publier_utilisateur(conversation.client_id, "ecrit", trame)
