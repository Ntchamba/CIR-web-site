"""Composition des e-mails : langue du destinataire, modèles enregistrés, gabarit commun, désabonnement.

Tout ce qui vient d'un utilisateur (nom, référence, texte d'un modèle) est échappé en HTML. Le sujet est nettoyé de
tout retour à la ligne (protection contre l'injection d'en-têtes).
"""
import logging

from django.conf import settings
from django.core import signing
from django.utils import translation
from django.utils.html import format_html, format_html_join
from django.utils.translation import gettext as _
from integrations.gmail import client as gmail

from apps.noyau.langues import LANGUE_PAR_DEFAUT, code_court, code_django

from . import evenements
from .models import ModeleEmail, TypeNotification

journal = logging.getLogger("cir.notifications")

SEL_DESABONNEMENT = "cir.notifications.desabonnement"
PIED = "Complexe Industriel Révélation SARL, Douala"  # nom propre : jamais traduit


def formater_montant(montant):
    """« 1 250 000 FCFA » (espace insécable fine entre les milliers) ; vide si le montant est inconnu."""
    if montant in (None, ""):
        return ""
    try:
        valeur = int(montant)
    except (TypeError, ValueError):
        return ""
    return f"{valeur:,}".replace(",", " ") + " FCFA"


# --- Désabonnement des nouveautés ---

def jeton_desabonnement(utilisateur):
    """Jeton signé (sans expiration) qui désigne le compte à désabonner."""
    return signing.dumps({"u": utilisateur.pk}, salt=SEL_DESABONNEMENT, compress=True)


def utilisateur_du_jeton(jeton):
    """Identifiant du compte désigné par le jeton, ou None s'il est faux."""
    try:
        return int(signing.loads(jeton, salt=SEL_DESABONNEMENT, max_age=None)["u"])
    except (signing.BadSignature, KeyError, TypeError, ValueError):
        return None


def adresse_desabonnement(utilisateur):
    base = settings.API_URL_PUBLIQUE
    if not base:
        return ""
    return f"{base}/api/notifications/desabonnement/?jeton={jeton_desabonnement(utilisateur)}"


# --- Composition ---

def _modele(evenement, langue):
    return ModeleEmail.objects.filter(evenement=evenement, langue=langue).first()


def _lignes(evenement, donnees, langue):
    """Lignes de détail fixées par le code : [(libellé ou None, valeur)]."""
    lignes = []
    if evenement == TypeNotification.NOUVEAUTE:
        titres, resumes = donnees.get("titres") or {}, donnees.get("resumes") or {}
        titre = titres.get(langue) or titres.get(LANGUE_PAR_DEFAUT) or ""
        resume = resumes.get(langue) or resumes.get(LANGUE_PAR_DEFAUT) or ""
        return [(None, texte) for texte in (titre, resume) if texte]
    if donnees.get("reference"):
        lignes.append((_("Référence"), donnees["reference"]))
    if evenement == TypeNotification.ETAPE_CHANGEE and donnees.get("etape"):
        lignes.append((_("Étape"), evenements.variables_de(donnees)["etape"]))
    paiements = (TypeNotification.PAIEMENT_RECU, TypeNotification.PAIEMENT_RECU_EQUIPE,
                 TypeNotification.PAIEMENT_ANOMALIE)
    if evenement in paiements and donnees.get("paiement_reference"):
        lignes.append((_("Paiement"), donnees["paiement_reference"]))
    if evenement in (TypeNotification.CONTRAT_SIGNE, TypeNotification.DEVIS_ENVOYE, *paiements) and (
            donnees.get("montant") or donnees.get("exemple")):
        lignes.append((_("Montant"), evenements.variables_de(donnees)["montant"]))
    if evenement in (TypeNotification.PAIEMENT_RECU, TypeNotification.PAIEMENT_RECU_EQUIPE) and (
            donnees.get("reste_a_payer") is not None or donnees.get("exemple")):
        reste = "[montant]" if donnees.get("exemple") else formater_montant(donnees.get("reste_a_payer"))
        lignes.append((_("Reste à payer"), reste))
    return lignes


def composer(evenement, utilisateur, donnees, *, sujet=None, introduction=None, langue=None):
    """Compose un e-mail : `{sujet, texte, html, entetes}` dans la langue du destinataire.

    `sujet` et `introduction` (aperçu d'un modèle) remplacent le modèle enregistré et le texte par défaut.
    """
    langue = code_court(langue or utilisateur.langue)
    equipe = utilisateur.est_equipe
    with translation.override(code_django(langue)):
        sujet_defaut, introduction_defaut = evenements.textes_par_defaut(evenement)
        modele = _modele(evenement, langue) if sujet is None and introduction is None else None
        sujet_modele = sujet if sujet is not None else (modele.sujet if modele else sujet_defaut)
        intro_modele = introduction if introduction is not None else (modele.introduction if modele
                                                                       else introduction_defaut)
        valeurs = evenements.variables_de(donnees)
        titre = " ".join(evenements.formater(sujet_modele, valeurs, sujet_defaut).split())  # une seule ligne
        intro = evenements.formater(intro_modele, valeurs, introduction_defaut).strip()
        lignes = _lignes(evenement, donnees, langue)
        chemin = evenements.lien(evenement, donnees, equipe)
        base = settings.ADMIN_URL_PUBLIQUE if equipe else settings.SITE_URL
        adresse = f"{base}{chemin}" if base else ""
        libelle = _("Ouvrir dans le tableau de bord") if equipe else _("Voir sur le site")
        desabonnement, entetes, pied = "", {}, PIED
        if evenement == TypeNotification.NOUVEAUTE:
            desabonnement = adresse_desabonnement(utilisateur)
            if desabonnement:
                entetes = {"List-Unsubscribe": f"<{desabonnement}>",
                           "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}
                pied = PIED + " · " + _("Vous recevez ce message parce que vous avez accepté de recevoir les "
                                        "nouveautés. Pour ne plus en recevoir, ouvrez ce lien :")
        corps_html = format_html("<p>{}</p>{}", intro, format_html_join(
            "", '<p style="margin:12px 0 0;">{}{}</p>', (
                (format_html("<strong>{} :</strong> ", libelle_ligne) if libelle_ligne else "", valeur)
                for libelle_ligne, valeur in lignes)))
        corps_texte = "\n\n".join([intro, *[f"{lib} : {val}" if lib else val for lib, val in lignes]])
        texte, html = gmail.rendre_gabarit(
            titre=titre, corps_html=corps_html, corps_texte=corps_texte, lien=adresse, libelle_lien=libelle,
            pied=pied,
            lien_desabonnement=desabonnement, langue=langue)
    return {"sujet": titre, "texte": texte, "html": html, "entetes": entetes}
