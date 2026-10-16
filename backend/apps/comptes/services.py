"""Règles métier des comptes. Les vues et sérialiseurs ne font qu'appeler ces fonctions."""
from django.conf import settings
from django.contrib.auth import password_validation
from django.core.cache import cache
from django.core.exceptions import ValidationError as ErreurDjango
from django.db import IntegrityError, transaction
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.noyau.langues import LANGUE_PAR_DEFAUT, CODES_LANGUES, langue_active

from .adresses import nettoyer, valider_adresse
from .models import Utilisateur
from .roles import ROLES_EQUIPE, Role

CHAMPS_PROFIL_MODIFIABLES = ("nom_complet", "telephone", "ville", "quartier", "rue_ou_repere", "langue")


# --- Contrôles communs ---

def normaliser_email(email):
    return str(email or "").strip().lower()


def verifier_email_disponible(email):
    email = normaliser_email(email)
    if Utilisateur.objects.filter(email__iexact=email).exists():
        raise ValidationError({"email": [_("Un compte existe déjà avec cette adresse e-mail.")]})
    return email


def verifier_mot_de_passe(mot_de_passe, utilisateur=None):
    try:
        password_validation.validate_password(mot_de_passe, utilisateur)
    except ErreurDjango as erreur:
        raise ValidationError({"mot_de_passe": list(erreur.messages)}) from erreur


def verifier_nom(nom_complet):
    nom = nettoyer(nom_complet)
    if not nom:
        raise ValidationError({"nom_complet": [_("Le nom complet est obligatoire.")]})
    return nom


def verifier_langue(langue):
    """Langue préférée d'un compte : l'un des codes courts proposés (fr, en, zh, de, ja)."""
    if langue not in CODES_LANGUES:
        raise ValidationError({"langue": [_("Langue non prise en charge.")]})
    return langue


def _creer_sans_doublon(**champs):
    """Crée le compte ; deux inscriptions simultanées avec le même e-mail donnent une erreur propre."""
    try:
        with transaction.atomic():
            return Utilisateur.objects.create_user(**champs)
    except IntegrityError as erreur:
        raise ValidationError({"email": [_("Un compte existe déjà avec cette adresse e-mail.")]}) from erreur


# --- Clients ---

@transaction.atomic
def inscrire_client(*, email, mot_de_passe, nom_complet, telephone="", langue=None, **adresse):
    """BF-08 : crée un compte client. L'adresse complète est exigée dès l'inscription.

    `langue` : langue préférée (e-mails, échanges) ; par défaut celle de la requête (Accept-Language).
    """
    email = verifier_email_disponible(email)
    langue = verifier_langue(langue or langue_active())
    nom = verifier_nom(nom_complet)
    adresse_propre = valider_adresse(adresse)
    brouillon = Utilisateur(email=email, nom_complet=nom)
    verifier_mot_de_passe(mot_de_passe, brouillon)
    return _creer_sans_doublon(
        email=email,
        password=mot_de_passe,
        nom_complet=nom,
        telephone=nettoyer(telephone),
        role=Role.CLIENT,
        langue=langue,
        **adresse_propre,
    )


def mettre_a_jour_profil(utilisateur, donnees):
    """Modifie le profil (nom, téléphone, adresse, langue). L'e-mail et le rôle ne se changent pas ici."""
    modifs = {}
    if "nom_complet" in donnees:
        modifs["nom_complet"] = verifier_nom(donnees["nom_complet"])
    if "telephone" in donnees:
        modifs["telephone"] = nettoyer(donnees["telephone"])
    if "langue" in donnees:
        modifs["langue"] = verifier_langue(donnees["langue"])
    modifs.update(valider_adresse(donnees, partielle=True))
    for champ, valeur in modifs.items():
        setattr(utilisateur, champ, valeur)
    if modifs:
        utilisateur.save(update_fields=list(modifs))
    return utilisateur


def peut_commander(utilisateur):
    """Règle métier : une commande exige un compte actif et une adresse complète."""
    return bool(utilisateur and utilisateur.is_authenticated and utilisateur.is_active
                and utilisateur.adresse_complete)


# --- Équipe (BF-17) ---

def _exiger_super_admin(demandeur):
    if not (demandeur and demandeur.is_authenticated and demandeur.est_super_admin):
        raise PermissionDenied(_("Accès réservé aux super-administrateurs."))


@transaction.atomic
def ajouter_membre(demandeur, *, email, mot_de_passe, nom_complet, telephone="", role=Role.MEMBRE,
                   langue=LANGUE_PAR_DEFAUT):
    _exiger_super_admin(demandeur)
    if role not in ROLES_EQUIPE:
        raise ValidationError({"role": [_("Rôle invalide pour un membre de l'équipe.")]})
    langue = verifier_langue(langue)
    email = verifier_email_disponible(email)
    nom = verifier_nom(nom_complet)
    verifier_mot_de_passe(mot_de_passe, Utilisateur(email=email, nom_complet=nom))
    return _creer_sans_doublon(
        email=email, password=mot_de_passe, nom_complet=nom, telephone=nettoyer(telephone), role=role,
        langue=langue,
    )


def desactiver_membre(demandeur, membre):
    """Retire l'accès d'un membre (le compte est conservé pour l'historique)."""
    _exiger_super_admin(demandeur)
    if not membre.est_equipe:
        raise ValidationError({"detail": _("Ce compte n'appartient pas à l'équipe.")})
    if membre.pk == demandeur.pk:
        raise ValidationError({"detail": _("Vous ne pouvez pas retirer votre propre accès.")})
    if membre.est_super_admin:
        autres = Utilisateur.objects.filter(role=Role.SUPER_ADMIN, is_active=True).exclude(pk=membre.pk)
        if not autres.exists():
            raise ValidationError({"detail": _("Il doit rester au moins un super-administrateur actif.")})
    membre.is_active = False
    membre.save(update_fields=["is_active"])
    return membre


def reactiver_membre(demandeur, membre):
    _exiger_super_admin(demandeur)
    if not membre.est_equipe:
        raise ValidationError({"detail": _("Ce compte n'appartient pas à l'équipe.")})
    membre.is_active = True
    membre.save(update_fields=["is_active"])
    return membre


# --- Connexion : blocage après trop d'essais incorrects (BNF-01) ---

# Le compteur principal est par e-mail (quelle que soit l'adresse IP, que le client peut masquer) et
# il est partagé entre la connexion publique et celle du tableau de bord. Un second compteur, par IP,
# freine l'essai de nombreux comptes depuis une même adresse.

def cle_connexion(email, ip=None):
    cle = f"cir:connexion:{normaliser_email(email)}"
    return f"{cle}:{ip}" if ip else cle


def cle_connexion_ip(ip):
    return f"cir:connexion-ip:{ip}"


def connexion_bloquee(cle, seuil=None):
    return cache.get(cle, 0) >= (seuil or settings.CONNEXION_ESSAIS_MAX)


def enregistrer_echec_connexion(cle):
    try:
        cache.incr(cle)
    except ValueError:
        cache.set(cle, 1, settings.CONNEXION_BLOCAGE_SECONDES)


def reinitialiser_essais_connexion(cle):
    cache.delete(cle)
