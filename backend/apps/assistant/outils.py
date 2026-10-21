"""Outils du conseiller et de l'agent de fond : TOUS EN LECTURE SEULE.

- Aucune écriture : ce module ne crée, ne modifie et ne supprime rien (un test le vérifie).
- Schéma strict : arguments inconnus, types ou longueurs invalides → résultat « arguments_invalides » (rien n'est exécuté).
- Contexte de l'utilisateur : les commandes ne sont lues que pour le client connecté, jamais par un identifiant
  donné par le modèle sans contrôle de propriété. Commande d'un autre client ou visiteur : « introuvable ».
- Jamais d'adresse, de nom, d'e-mail ni de téléphone d'un compte dans un résultat.
- Les résultats sont des DONNÉES : une consigne qu'ils contiennent n'est jamais suivie.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from django.db.models import Count, Q
from django.utils import translation

from apps.catalogue.models import Produit
from apps.catalogue.services import familles_publiques
from apps.commandes import reglement
from apps.commandes.models import Commande
from apps.comptes.roles import Role
from apps.contenus.models import ContenuAccueil
from apps.noyau.langues import code_django
from apps.vitrine.models import Realisation
from integrations.gemini import outils as declarations_gemini

from .garde_fous import Coordonnees, LienAutorise

MAX_RESULTATS = 8
TEXTE_MAX = 1200
_CONTROLES = re.compile(r"[\x00-\x1f\x7f]")
_REFERENCE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._\-]{0,29}$")

# Champs numériques d'un résultat dont la valeur est un montant que l'assistant peut citer
CHAMPS_MONTANTS = frozenset({"prix_publie", "montant_convenu", "montant_paye", "reste_a_payer", "prix_m2", "total"})


@dataclass
class Contexte:
    """Contexte d'un tour : l'utilisateur qui parle (None : visiteur ou agent de fond) et sa langue."""

    utilisateur: object = None
    langue: str = "fr"
    proposer_contact: bool = False

    @property
    def client(self):
        u = self.utilisateur
        return u if (u is not None and getattr(u, "is_authenticated", False) and u.is_active
                     and u.role == Role.CLIENT) else None


@dataclass(frozen=True)
class Outil:
    nom: str
    description: str
    parametres: dict  # {nom: {"type": "string", "description": "…", "max": 100}}
    fonction: object
    client_seulement: bool = False

    def declaration(self):
        # « max » est une règle de notre schéma strict : la déclaration Gemini ne la connaît pas
        simple = {n: {k: v for k, v in p.items() if k != "max"} for n, p in self.parametres.items()}
        return declarations_gemini.declarer(self.nom, self.description, simple)


# --- Validation stricte -----------------------------------------------------------------------------------

class ArgumentsInvalides(Exception):
    pass


def valider_arguments(outil, arguments):
    """Renvoie les arguments nettoyés ou lève `ArgumentsInvalides`. Un texte vide vaut « non renseigné »."""
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict) or set(arguments) - set(outil.parametres):
        raise ArgumentsInvalides
    propres = {}
    for nom, schema in outil.parametres.items():
        valeur = arguments.get(nom, "")
        if valeur is None:
            valeur = ""
        if schema["type"] != "string" or not isinstance(valeur, str):
            raise ArgumentsInvalides
        valeur = " ".join(_CONTROLES.sub(" ", valeur).split())
        if len(valeur) > schema.get("max", 100):
            raise ArgumentsInvalides
        propres[nom] = valeur
    return propres


# --- Mise en forme ----------------------------------------------------------------------------------------

def _court(texte, limite=TEXTE_MAX):
    texte = " ".join(str(texte or "").split())
    return texte if len(texte) <= limite else texte[:limite - 1].rstrip() + "…"


def _chemin_produit(produit):
    return f"/catalogue/{produit.slug}"


def _carte_produit(produit, langue):
    return {"reference": produit.reference or produit.slug, "nom": produit.traduit("nom", langue),
            "famille": produit.famille.traduit("nom", langue),
            "resume": _court(produit.traduit("accroche", langue) or produit.traduit("description", langue), 200),
            "prix_publie": produit.prix, "chemin": _chemin_produit(produit)}


def _etape(etat, langue):
    from apps.commandes.etapes import Etat
    with translation.override(code_django(langue)):
        return str(Etat(etat).label)


def _produits_publies():
    return Produit.objects.filter(en_ligne=True).select_related("famille")


# --- Les 7 outils (lecture seule) -------------------------------------------------------------------------

def rechercher_produits(contexte, requete="", famille=""):
    produits = _produits_publies()
    for mot in requete.split()[:4]:
        produits = produits.filter(Q(nom__icontains=mot) | Q(reference__icontains=mot) | Q(accroche__icontains=mot)
                                   | Q(description__icontains=mot) | Q(famille__nom__icontains=mot))
    if famille:
        produits = produits.filter(Q(famille__nom__icontains=famille) | Q(famille__slug__icontains=famille))
    return {"produits": [_carte_produit(p, contexte.langue) for p in produits[:MAX_RESULTATS]]}


def fiche_produit(contexte, reference):
    if not reference:
        return {"introuvable": True}
    produit = (_produits_publies().filter(Q(reference__iexact=reference) | Q(slug=reference.lower()))
               .prefetch_related("caracteristiques", "designs", "couches").first())
    if produit is None:
        return {"introuvable": True}
    langue = contexte.langue
    champs = ("accroche", "description", "domaine_application", "performances", "preparation",
              "methode_application", "dosage", "conditions_chantier")
    fiche = _carte_produit(produit, langue)
    fiche.pop("resume")
    fiche.update({c: _court(produit.traduit(c, langue)) for c in champs if produit.traduit(c, langue)})
    fiche.update({
        "usages": produit.usages, "unite_prix": produit.unite_prix,
        "caracteristiques": [{"libelle": c.traduit("libelle", langue), "valeur": c.traduit("valeur", langue)}
                             for c in produit.caracteristiques.all()],
        "designs": [d.traduit("nom", langue) for d in produit.designs.all()],
        "couches": [{"nom": c.traduit("nom", langue), "epaisseur": c.epaisseur} for c in produit.couches.all()],
    })
    return fiche


def lister_familles(contexte):
    return {"familles": [{"nom": f.traduit("nom", contexte.langue), "chemin": f"/catalogue?famille={f.slug}",
                          "nombre_produits": f.nombre_produits} for f in familles_publiques()]}


def rechercher_realisations(contexte, requete=""):
    realisations = Realisation.objects.filter(publie=True)
    for mot in requete.split()[:4]:
        realisations = realisations.filter(Q(titre__icontains=mot) | Q(description__icontains=mot)
                                           | Q(ville__icontains=mot) | Q(type_chantier__icontains=mot))
    return {"realisations": [
        {"titre": r.traduit("titre", contexte.langue), "type_chantier": r.type_chantier, "lieu": r.ville,
         "chemin": "/realisations"} for r in realisations[:MAX_RESULTATS]]}


def lire_contenu_accueil():
    """Contenu de l'accueil s'il existe (lecture seule : pas de get_or_create)."""
    return ContenuAccueil.objects.filter(pk=1).first()


def coordonnees_publiques():
    """Coordonnées déjà affichées sur le site : seules autorisées dans une réponse."""
    contenu = lire_contenu_accueil()
    if contenu is None:
        return Coordonnees()
    telephones = [str(t) for t in (contenu.telephones or []) if isinstance(t, (str, int))] + [contenu.whatsapp]
    return Coordonnees(emails=tuple(e for e in [contenu.email] if e),
                       telephones=tuple(t for t in telephones if t))


def infos_entreprise(contexte):
    contenu = lire_contenu_accueil()
    if contenu is None:
        return {"disponible": False}
    langue = contexte.langue
    infos = {"disponible": True, "telephones": [str(t) for t in (contenu.telephones or [])],
             "whatsapp": contenu.whatsapp, "email": contenu.email, "adresse": contenu.adresse,
             "presentation": _court(contenu.traduit("accroche", langue), 400),
             "partenaire": _court(contenu.traduit("texte_partenaire", langue), 600)}
    return {k: v for k, v in infos.items() if v not in ("", [], None)}


def _proposition(commande):
    derniere = commande.propositions.order_by("-cree_le", "-id").first()
    if derniere is None:
        return None
    return {"auteur_role": derniere.auteur_role, "prix_m2": derniere.prix_m2, "total": derniere.total,
            "delai_jours": derniere.delai_jours, "etat": derniere.etat, "date": derniere.cree_le.date().isoformat()}


def _resume_commande(commande, langue):
    return {"reference": commande.reference, "etape": commande.etat, "etape_libelle": _etape(commande.etat, langue),
            "montant_convenu": commande.montant_convenu, "montant_paye": commande.montant_paye,
            "reste_a_payer": reglement.reste_a_payer(commande), "derniere_proposition": _proposition(commande),
            "date": commande.cree_le.date().isoformat(), "chemin": f"/commandes/{commande.pk}"}


def mes_commandes(contexte):
    client = contexte.client
    if client is None:
        return {"connexion_requise": True, "commandes": []}
    commandes = Commande.objects.filter(client=client).order_by("-cree_le", "-id")[:10]
    return {"commandes": [_resume_commande(c, contexte.langue) for c in commandes]}


def ma_commande(contexte, reference):
    client = contexte.client
    commande = None
    if client is not None and reference:
        commande = Commande.objects.filter(client=client, reference__iexact=reference).first()
    if commande is None:  # commande d'un autre client, inexistante ou visiteur : même réponse
        return {"introuvable": True}
    return _resume_commande(commande, contexte.langue)


def contacter_equipe(contexte, motif):
    """Ne fait rien d'autre que demander au site d'afficher les boutons « Écrire à l'équipe » / « Demander un devis »."""
    contexte.proposer_contact = True
    return {"ok": True, "information": "Les boutons pour joindre l'équipe vont être affichés au client."}


def _chaine(description, maximum=100):
    return {"type": "string", "description": description, "max": maximum}


OUTILS = {o.nom: o for o in (
    Outil("rechercher_produits",
          "Cherche dans le catalogue des produits publiés (jusqu'à 8). Formuler la requête en français. "
          "Laisser vide un paramètre inutile.",
          {"requete": _chaine("Mots-clés en français (nom, usage, référence). Vide : tous.", 100),
           "famille": _chaine("Nom ou identifiant d'une famille. Vide : toutes.", 60)}, rechercher_produits),
    Outil("fiche_produit", "Fiche complète d'un produit publié (description, caractéristiques, designs, prix publié).",
          {"reference": _chaine("Référence du produit, telle que renvoyée par rechercher_produits.", 30)},
          fiche_produit),
    Outil("lister_familles", "Liste les familles de produits du catalogue.", {}, lister_familles),
    Outil("rechercher_realisations", "Cherche parmi les réalisations publiées du CIR.",
          {"requete": _chaine("Mots-clés en français. Vide : toutes.", 100)}, rechercher_realisations),
    Outil("infos_entreprise", "Coordonnées et textes publics de l'entreprise, déjà affichés sur le site.", {},
          infos_entreprise),
    Outil("mes_commandes", "Commandes du client connecté (référence, étape, montants, dates). Client connecté seulement.",
          {}, mes_commandes, client_seulement=True),
    Outil("ma_commande", "Une commande du client connecté, par sa référence (ex. CIR-2026-0001).",
          {"reference": _chaine("Référence de la commande.", 20)}, ma_commande, client_seulement=True),
    Outil("contacter_equipe",
          "Invite le client à joindre l'équipe (boutons « Écrire à l'équipe » et « Demander un devis »). "
          "À utiliser pour tout prix, délai, remise, contrat, paiement ou réclamation, ou si tu ne sais pas.",
          {"motif": _chaine("Motif en quelques mots.", 200)}, contacter_equipe),
)}

OUTILS_CONSEILLER = tuple(OUTILS)
OUTILS_FOND = ("rechercher_produits", "fiche_produit", "lister_familles", "infos_entreprise")


def declarations(noms):
    return [OUTILS[n].declaration() for n in noms]


def _sur_json(valeur):
    """Résultat sérialisable en JSON (Decimal, dates, objets convertis)."""
    if isinstance(valeur, dict):
        return {str(k): _sur_json(v) for k, v in valeur.items()}
    if isinstance(valeur, (list, tuple)):
        return [_sur_json(v) for v in valeur]
    if isinstance(valeur, bool) or valeur is None or isinstance(valeur, (int, str)):
        return valeur
    if isinstance(valeur, Decimal):
        return int(valeur) if valeur == valeur.to_integral_value() else str(valeur)
    if isinstance(valeur, (date, datetime)):
        return valeur.isoformat()
    return str(valeur)


def executer(nom, arguments, contexte, noms_autorises):
    """Exécute l'outil demandé par le modèle. Un nom inconnu ou non déclaré pour ce tour n'est JAMAIS exécuté."""
    if not isinstance(nom, str) or nom not in noms_autorises or nom not in OUTILS:
        return {"erreur": "outil_inconnu"}
    outil = OUTILS[nom]
    try:
        propres = valider_arguments(outil, arguments)
        if nom in ("fiche_produit", "ma_commande") and propres["reference"] \
                and not _REFERENCE.match(propres["reference"]):
            raise ArgumentsInvalides
    except ArgumentsInvalides:
        return {"erreur": "arguments_invalides"}
    return _sur_json(outil.fonction(contexte, **propres))


# --- Ce que les résultats autorisent dans la réponse ------------------------------------------------------

def montants_de(resultat):
    """Montants (entiers) présents dans un résultat d'outil : les seuls que la réponse peut citer."""
    montants = set()
    if isinstance(resultat, dict):
        for cle, valeur in resultat.items():
            if cle in CHAMPS_MONTANTS and isinstance(valeur, int) and not isinstance(valeur, bool):
                montants.add(valeur)
            else:
                montants |= montants_de(valeur)
    elif isinstance(resultat, list):
        for element in resultat:
            montants |= montants_de(element)
    return montants


def liens_de(resultat):
    """`LienAutorise` pour chaque élément d'un résultat qui porte un `chemin` interne."""
    liens = []
    if isinstance(resultat, dict):
        chemin = resultat.get("chemin")
        if isinstance(chemin, str) and chemin.startswith("/") and not chemin.startswith("//"):
            libelle = resultat.get("nom") or resultat.get("titre") or resultat.get("reference") or chemin
            mots = tuple(m for m in (resultat.get("nom"), resultat.get("reference"), resultat.get("titre")) if m)
            liens.append(LienAutorise(str(libelle), chemin, mots))
        for valeur in resultat.values():
            liens.extend(liens_de(valeur))
    elif isinstance(resultat, list):
        for element in resultat:
            liens.extend(liens_de(element))
    return liens
