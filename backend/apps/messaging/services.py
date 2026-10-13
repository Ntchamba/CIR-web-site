"""Messagerie instantanée : création des messages et diffusion en temps réel (WebSocket)."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Conversation, Message


def groupe_conversation(conversation_id):
    return f"conversation_{conversation_id}"


def groupe_utilisateur(utilisateur):
    """Canal personnel : « equipe » pour tous les membres de l'équipe, « client_<id> » pour un client."""
    return "equipe" if utilisateur.is_staff else f"client_{utilisateur.pk}"


def conversation_de_commande(commande):
    conversation, _ = Conversation.objects.get_or_create(
        commande=commande, defaults={"client": commande.client, "sujet": f"Commande {commande.numero}"})
    return conversation


def diffuser(message):
    """Envoie le message aux personnes connectées : la conversation ouverte et les badges non lus."""
    from .serializers import MessageSerializer

    couche = get_channel_layer()
    if couche is None:
        return
    donnees = MessageSerializer(message).data
    donnees["cree_le"] = message.cree_le.isoformat()
    conversation = message.conversation
    envoyer = async_to_sync(couche.group_send)
    envoyer(groupe_conversation(conversation.pk), {"type": "message.nouveau", "message": donnees})
    resume = {"type": "conversation.maj", "conversation": conversation.pk, "message": donnees}
    envoyer("equipe", resume)
    envoyer(f"client_{conversation.client_id}", resume)


def envoyer_message(conversation, auteur, texte):
    message = Message.objects.create(
        conversation=conversation, auteur=auteur, texte=texte,
        lu_par_client=not auteur.is_staff, lu_par_equipe=auteur.is_staff)
    conversation.save(update_fields=["modifie_le"])
    diffuser(message)
    return message


def message_systeme(commande, texte):
    conversation = conversation_de_commande(commande)
    message = Message.objects.create(conversation=conversation, est_systeme=True, texte=texte,
                                     lu_par_client=True, lu_par_equipe=True)
    conversation.save(update_fields=["modifie_le"])
    diffuser(message)
    return message


def marquer_lus(conversation, lecteur):
    if lecteur.is_staff:
        return conversation.messages.filter(lu_par_equipe=False).update(lu_par_equipe=True)
    return conversation.messages.filter(lu_par_client=False).update(lu_par_client=True)
