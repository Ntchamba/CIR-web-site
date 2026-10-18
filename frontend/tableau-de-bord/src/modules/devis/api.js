// BF-11, BF-12 : devis et demandes de rendu côté équipe (/api/admin/devis/), voir docs/taches/vague-2-contrat-api.md.
// Le calcul d'un devis se fait UNIQUEMENT sur le serveur (`calculer/`) : le front n'en recopie pas la formule.
import { api, resultats } from '@/app/api.js';

const BASE = '/api/admin/devis/';
const RENDU = `${BASE}demandes-rendu/`;

function requete(base, criteres = {}) {
  const params = new URLSearchParams();
  const { etat = '', recherche = '', commande = '', page = 1 } = criteres;
  if (etat) params.set('etat', etat);
  if (commande) params.set('commande', String(commande));
  if (recherche.trim()) params.set('search', recherche.trim());
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return texte ? `${base}?${texte}` : base;
}

// --- Devis ---

/** → { count, next, previous, results: [{ id, reference, commande, commande_reference, etat, expire, total, valide_jusqu_au, envoye_le }] } */
export const listerDevis = (criteres, { signal } = {}) => api.get(requete(BASE, criteres), { signal });
export const obtenirDevis = (id, { signal } = {}) => api.get(`${BASE}${encodeURIComponent(id)}/`, { signal });
/** `{ commande, demande?, validite_jours?, notes?, lignes }` → brouillon (201). */
export const creerDevis = (donnees) => api.post(BASE, donnees);
/** Brouillon seulement ; `lignes` est remplacée en entier. */
export const modifierDevis = (id, donnees) => api.patch(`${BASE}${id}/`, donnees);
export const supprimerDevis = (id) => api.supprimer(`${BASE}${id}/`);
/** Aperçu sans rien enregistrer → { lignes: [{…calculés}], total, complet, erreurs: [{ ligne, champ, message }] }. */
export const calculerDevis = (lignes, { signal } = {}) => api.post(`${BASE}calculer/`, { lignes }, { signal });
/** Passe le devis à « envoyé » et crée la proposition de l'équipe → devis. */
export const envoyerDevis = (id) => api.post(`${BASE}${id}/envoyer/`, {});

// --- Demandes de rendu ---

export const listerDemandesRendu = (criteres, { signal } = {}) => api.get(requete(RENDU, criteres), { signal });
export const obtenirDemandeRendu = (id, { signal } = {}) => api.get(`${RENDU}${encodeURIComponent(id)}/`, { signal });
/** `{ etat?, reponse_equipe?, notes_internes? }` */
export const modifierDemandeRendu = (id, donnees) => api.patch(`${RENDU}${id}/`, donnees);
/** → { nouvelle, en_etude, devis_envoye, close, total } */
export const resumeDemandesRendu = ({ signal } = {}) => api.get(`${RENDU}resume/`, { signal });

// --- Données utiles à l'éditeur ---

/** Commande à laquelle le devis se rattache (référence, client, surface, lignes). */
export const obtenirCommandeDuDevis = (id, { signal } = {}) => api.get(`/api/admin/commandes/${encodeURIComponent(id)}/`, { signal });

/** Commandes d'un client encore ouvertes (ni terminées ni annulées), 100 au plus. */
export const listerCommandesOuvertesDuClient = (clientId, { signal } = {}) =>
  api.get(`/api/admin/commandes/?client=${encodeURIComponent(clientId)}&taille=100`, { signal })
    .then(resultats)
    .then((liste) => liste.filter((c) => !['terminee', 'annulee'].includes(c.etat)));

/** Produits du catalogue (100 au plus) : id, nom, reference, prix (ou null), unite_prix ('m2' | 'kg' | 'pose'). */
export const listerProduitsDuCatalogue = ({ signal } = {}) =>
  api.get('/api/admin/catalogue/produits/?taille=100', { signal }).then(resultats);
