"""Règles métier des notifications. Les vues, les abonnés aux signaux et les commandes ne font qu'appeler ces fonctions.

- `notifier` crée la notification de l'application (poussée en direct) et, selon l'événement et les préférences,
  la ligne de la file d'envoi (`EnvoiEmail`) dans la même transaction que l'action d'origine ;
- le texte d'une notification est produit à la lecture, dans la langue de la requête.
"""
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Count
from django.utils import timezone, translation
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.fields import DateTimeField

from apps.comptes.models import Utilisateur
from apps.noyau import direct, presence
from apps.noyau.langues import CODES_LANGUES, code_court, code_django

from . import courriels, evenements
from .models import EnvoiEmail, EtatEnvoi, ModeleEmail, Notification, TypeNotification

journal = logging.getLogger("cir.notifications")
T = TypeNotification
PAGE_RECENTES = 50


# --- Lecture ---

def _date(valeur):
    return DateTimeField().to_representation(valeur) if valeur else None


def texte_notification(type_, donnees, equipe=False):
    """(titre, texte, lien) dans la langue active, à partir de `type` et `donnees` (rien n'est figé en base)."""
    if type_ == T.NOUVEAUTE:
        langue = code_court(translation.get_language())
        titres, resumes = donnees.get("titres") or {}, donnees.get("resumes") or {}
        titre = titres.get(langue) or titres.get("fr") or ""
        texte = resumes.get(langue) or resumes.get("fr") or ""
        return titre, texte, evenements.lien(type_, donnees, equipe)
    if type_ not in evenements.TEXTES:
        return "", "", "/"
    sujet, introduction = evenements.textes_par_defaut(type_)
    valeurs = evenements.variables_de(donnees)
    nombre = donnees.get("nombre")
    if type_ == T.MESSAGE_NOUVEAU and nombre and int(nombre) > 1:
        valeurs["nom"] = f"{valeurs['nom']} ({int(nombre)})"
    return (evenements.formater(sujet, valeurs, sujet), evenements.formater(introduction, valeurs, introduction),
            evenements.lien(type_, donnees, equipe))


def notification_en_dict(notification, equipe=None):
    """<Notification> du contrat, dans la langue active."""
    if equipe is None:
        equipe = notification.utilisateur.est_equipe
    titre, texte, lien = texte_notification(notification.type, notification.donnees or {}, equipe)
    return {"id": notification.pk, "type": notification.type, "titre": titre, "texte": texte, "lien": lien,
            "lue": notification.lue, "cree_le": _date(notification.cree_le)}


def notifications_de(utilisateur, parametres=None):
    qs = Notification.objects.filter(utilisateur=utilisateur)
    lue = (parametres or {}).get("lue", "").strip()
    if lue in ("0", "1"):
        qs = qs.filter(lue=(lue == "1"))
    return qs.order_by("-cree_le", "-id")


def compter_non_lues(utilisateur):
    return Notification.objects.filter(utilisateur=utilisateur, lue=False).count()


def marquer_lue(utilisateur, pk):
    notification = Notification.objects.filter(pk=pk, utilisateur=utilisateur).first()
    if notification is None:
        raise NotFound(_("Notification introuvable."))
    if not notification.lue:
        notification.lue = True
        notification.save(update_fields=["lue"])
        direct.publier_compteurs(utilisateur)
    return notification


def marquer_toutes_lues(utilisateur):
    modifiees = Notification.objects.filter(utilisateur=utilisateur, lue=False).update(lue=True)
    if modifiees:
        direct.publier_compteurs(utilisateur)
    return 0


# --- Création ---

def peut_recevoir_email(utilisateur, evenement):
    """Préférences : l'équipe choisit (`email_equipe`), les nouveautés exigent un consentement."""
    if not utilisateur.is_active or not utilisateur.email:
        return False
    if evenement == T.NOUVEAUTE:
        return utilisateur.recevoir_nouveautes
    if utilisateur.est_equipe:
        return utilisateur.email_equipe
    return True


def mettre_en_file(utilisateur, evenement, donnees, cle_unique):
    """Ajoute l'e-mail à la file d'envoi (sans doublon). Renvoie la ligne créée, ou None."""
    if not peut_recevoir_email(utilisateur, evenement):
        return None
    if evenement == T.NOUVEAUTE and not settings.API_URL_PUBLIQUE:
        journal.warning("Nouveauté non envoyée par e-mail : API_URL_PUBLIQUE manque (lien de désabonnement).")
        return None
    mail = courriels.composer(evenement, utilisateur, donnees)
    envoi, cree = EnvoiEmail.objects.get_or_create(cle_unique=cle_unique[:190], defaults={
        "destinataire_email": utilisateur.email, "utilisateur": utilisateur, "evenement": evenement,
        "sujet": mail["sujet"][:300], "corps_texte": mail["texte"], "corps_html": mail["html"],
        "entetes": mail["entetes"], "prochaine_tentative": timezone.now()})
    if cree and settings.NOTIFICATIONS_ENVOI_IMMEDIAT and evenement != T.MESSAGE_NOUVEAU:
        from . import taches

        transaction.on_commit(lambda: taches.traiter_sans_erreur(envoi.pk))
    return envoi if cree else None


def pousser(utilisateur, notification):
    """Notification et compteurs poussés en direct (langue du destinataire)."""
    with translation.override(code_django(utilisateur.langue)):
        trame = {"notification": notification_en_dict(notification, utilisateur.est_equipe)}
    direct.publier_utilisateur(utilisateur.pk, "notification", trame)
    direct.publier_compteurs(utilisateur)


def notifier(utilisateur, type_, donnees, *, cle_unique=None, avec_email=True):
    """Crée la notification de l'application et, si `cle_unique` est fournie, l'e-mail correspondant."""
    notification = Notification.objects.create(utilisateur=utilisateur, type=type_, donnees=donnees)
    pousser(utilisateur, notification)
    if avec_email and cle_unique:
        mettre_en_file(utilisateur, type_, donnees, cle_unique)
    return notification


def notifier_message(utilisateur, donnees):
    """Message non lu : une seule notification par conversation (elle compte les messages), sans e-mail immédiat."""
    existante = Notification.objects.filter(utilisateur=utilisateur, type=T.MESSAGE_NOUVEAU, lue=False,
                                            donnees__conversation=donnees["conversation"]).first()
    if existante is None:
        return notifier(utilisateur, T.MESSAGE_NOUVEAU, {**donnees, "nombre": 1}, avec_email=False)
    existante.donnees = {**existante.donnees, "nombre": int(existante.donnees.get("nombre", 1)) + 1}
    existante.cree_le = timezone.now()
    existante.save(update_fields=["donnees", "cree_le"])
    pousser(utilisateur, existante)
    return existante


def membres_equipe():
    return list(Utilisateur.objects.equipe().filter(is_active=True))


def marquer_messages_lus(conversation_id, destinataires):
    """Les messages de la conversation ont été lus : leurs notifications le sont aussi."""
    for utilisateur in destinataires:
        Notification.objects.filter(utilisateur=utilisateur, type=T.MESSAGE_NOUVEAU, lue=False,
                                    donnees__conversation=conversation_id).update(lue=True)


# --- Préférences ---

def preferences_client(utilisateur):
    return {"recevoir_nouveautes": utilisateur.recevoir_nouveautes}


def preferences_equipe(utilisateur):
    return {"email_equipe": utilisateur.email_equipe}


def modifier_preference(utilisateur, champ, valeur):
    if not isinstance(valeur, bool):
        raise ValidationError({champ: [_("Indiquez vrai ou faux.")]})
    setattr(utilisateur, champ, valeur)
    utilisateur.save(update_fields=[champ])
    return utilisateur


def desabonner(jeton):
    """Désactive les nouveautés du compte désigné par le jeton signé. Renvoie True si le jeton est valide."""
    identifiant = courriels.utilisateur_du_jeton(jeton or "")
    if identifiant is None:
        return False
    modifie = Utilisateur.objects.filter(pk=identifiant, role="client").update(recevoir_nouveautes=False)
    return bool(modifie)


# --- Modèles d'e-mails (super-administrateur) ---

def _evenement_connu(evenement):
    if evenement not in evenements.EVENEMENTS:
        raise NotFound(_("Événement inconnu."))


def _langue_connue(langue):
    if langue not in CODES_LANGUES:
        raise NotFound(_("Langue inconnue."))


def liste_modeles():
    """Tous les événements avec, par langue, le texte par défaut et le modèle enregistré."""
    enregistres = {(m.evenement, m.langue): m for m in ModeleEmail.objects.all()}
    resultat = []
    for evenement in evenements.EVENEMENTS:
        langues = []
        for langue in CODES_LANGUES:
            with translation.override(code_django(langue)):
                sujet, introduction = evenements.textes_par_defaut(evenement)
            modele = enregistres.get((evenement, langue))
            langues.append({
                "langue": langue,
                "defaut": {"sujet": sujet, "introduction": introduction},
                "modele": {"sujet": modele.sujet, "introduction": modele.introduction} if modele else None})
        resultat.append({"evenement": str(evenement), "libelle": str(TypeNotification(evenement).label),
                         "variables": list(evenements.VARIABLES), "langues": langues})
    return resultat


def _controler_texte(champ, valeur, maximum):
    valeur = str(valeur or "").strip()
    if not valeur:
        raise ValidationError({champ: [_("Ce champ est obligatoire.")]})
    if len(valeur) > maximum:
        raise ValidationError({champ: [_("Ce texte est trop long (%(max)s caractères au plus).") % {"max": maximum}]})
    if champ == "sujet" and ("\n" in valeur or "\r" in valeur):
        raise ValidationError({champ: [_("Le sujet doit tenir sur une seule ligne.")]})
    try:
        inconnues = evenements.verifier_texte(valeur)
    except ValueError:
        raise ValidationError({champ: [_("Les accolades de ce texte sont mal formées.")]}) from None
    if inconnues:
        raise ValidationError({champ: [_("Variable non autorisée : {%(nom)s}. Variables permises : %(liste)s.")
                                       % {"nom": inconnues[0],
                                          "liste": ", ".join("{" + v + "}" for v in evenements.VARIABLES)}]})
    return valeur


def enregistrer_modele(evenement, langue, donnees):
    _evenement_connu(evenement)
    _langue_connue(langue)
    sujet = _controler_texte("sujet", donnees.get("sujet"), evenements.SUJET_MAX)
    introduction = _controler_texte("introduction", donnees.get("introduction"), evenements.INTRODUCTION_MAX)
    modele, _cree = ModeleEmail.objects.update_or_create(evenement=evenement, langue=langue,
                                                         defaults={"sujet": sujet, "introduction": introduction})
    return modele


def supprimer_modele(evenement, langue):
    _evenement_connu(evenement)
    _langue_connue(langue)
    ModeleEmail.objects.filter(evenement=evenement, langue=langue).delete()


def apercu(evenement, langue, donnees):
    """Aperçu d'un e-mail avec des valeurs d'exemple (jamais de vrai client ni de vrai montant)."""
    _evenement_connu(evenement)
    _langue_connue(langue)
    sujet = _controler_texte("sujet", donnees["sujet"], evenements.SUJET_MAX) if donnees.get("sujet") else None
    introduction = (_controler_texte("introduction", donnees["introduction"], evenements.INTRODUCTION_MAX)
                    if donnees.get("introduction") else None)
    exemple = {"exemple": True, "nom": "[nom]", "reference": "[reference]", "etape": "travaux", "commande": 0,
               "titres": {"fr": "[titre]"}, "resumes": {}}
    visiteur = Utilisateur(email="exemple@exemple.invalid", nom_complet="[nom]", langue=langue)
    mail = courriels.composer(evenement, visiteur, exemple, sujet=sujet, introduction=introduction, langue=langue)
    return {"sujet": mail["sujet"], "corps_html": mail["html"], "corps_texte": mail["texte"]}


# --- Envois (super-administrateur) ---

def masquer_email(adresse):
    """« jean@exemple.cm » → « j***@exemple.cm »."""
    local, arobase, domaine = str(adresse or "").partition("@")
    if not arobase:
        return "***"
    return f"{local[:1]}***@{domaine}"


def envois(parametres):
    qs = EnvoiEmail.objects.all()
    etat = parametres.get("etat", "").strip()
    if etat in EtatEnvoi.values:
        qs = qs.filter(etat=etat)
    return qs.order_by("-id")


def resume_envois():
    from integrations.gmail import client as gmail

    compteurs = {etat: 0 for etat in EtatEnvoi.values}
    for ligne in EnvoiEmail.objects.values("etat").annotate(n=Count("id")):
        compteurs[ligne["etat"]] = ligne["n"]
    return {**compteurs, "gmail_configure": gmail.configure()}


def reessayer(pk):
    """Remet un envoi en échec dans la file."""
    envoi = EnvoiEmail.objects.filter(pk=pk).first()
    if envoi is None:
        raise NotFound(_("Envoi introuvable."))
    if envoi.etat != EtatEnvoi.ECHEC:
        raise ValidationError({"detail": _("Seul un envoi en échec peut être relancé.")})
    envoi.etat = EtatEnvoi.EN_ATTENTE
    envoi.tentatives = 0
    envoi.prochaine_tentative = timezone.now()
    envoi.derniere_erreur = ""
    envoi.save(update_fields=["etat", "tentatives", "prochaine_tentative", "derniere_erreur"])
    return envoi


# --- Nouveautés (BF-07) ---

LOT_NOUVEAUTES = 500


def diffuser_nouveaute(actualite):
    """Une nouveauté devenue visible : centre de notifications de tous les clients, e-mail seulement avec consentement."""
    titres = {langue: actualite.traduit("titre", langue) for langue in CODES_LANGUES}
    resumes = {langue: actualite.traduit("resume", langue) for langue in CODES_LANGUES}
    donnees = {"actualite": actualite.pk, "slug": actualite.slug, "titres": titres, "resumes": resumes}
    clients = Utilisateur.objects.clients().filter(is_active=True).order_by("pk")
    lot = []
    for client in clients.iterator(chunk_size=LOT_NOUVEAUTES):
        lot.append(client)
        if len(lot) >= LOT_NOUVEAUTES:
            _diffuser_lot(lot, donnees)
            lot = []
    if lot:
        _diffuser_lot(lot, donnees)


def _diffuser_lot(clients, donnees):
    notifications = Notification.objects.bulk_create(
        [Notification(utilisateur=c, type=T.NOUVEAUTE, donnees=donnees) for c in clients])
    for client, notification in zip(clients, notifications):
        if notification.pk and presence.est_en_ligne(client.pk):  # les autres la verront à leur prochaine visite
            pousser(client, notification)
        if client.recevoir_nouveautes:
            mettre_en_file(client, T.NOUVEAUTE, {**donnees, "nom": client.nom_complet},
                           cle_unique=f"nouveaute:{donnees['actualite']}:{client.pk}")


def texte_erreur_envoi(code):
    """Texte (langue de la requête) d'un code d'erreur enregistré dans `EnvoiEmail.derniere_erreur`."""
    textes = {
        "destinataire_invalide": _("Destinataire sans adresse valide ou compte désactivé."),
        "erreur_inattendue": _("Erreur inattendue pendant l'envoi."),
        "GmailErreurTemporaire": _("Gmail est indisponible ou injoignable pour le moment (nouvel essai prévu)."),
        "GmailErreurDefinitive": _("Gmail a refusé l'envoi (adresse refusée ou configuration à vérifier)."),
        "GmailNonConfigure": _("Gmail n'est pas configuré."),
    }
    if not code:
        return ""
    return textes.get(code, _("Erreur d'envoi."))
