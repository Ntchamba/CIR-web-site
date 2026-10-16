// BF-01, BF-05, BF-06, BF-14 : catalogue côté équipe (/api/admin/catalogue/), voir docs/taches/vague-1-contrat-api.md.
import { api, resultats } from '@/app/api.js';
import { envoyer } from '@/composants/envoi.js';

const BASE = '/api/admin/catalogue/';

// --- Familles (liste simple) ---

/** → [{ id, nom, slug, description, ordre, traductions, langues_incompletes, nombre_produits }] */
export const listerFamilles = ({ signal } = {}) => api.get(`${BASE}familles/`, { signal }).then(resultats);
export const creerFamille = (donnees) => api.post(`${BASE}familles/`, donnees);
export const modifierFamille = (id, donnees) => api.patch(`${BASE}familles/${id}/`, donnees);
/** 400 { detail } si la famille a encore des produits. */
export const supprimerFamille = (id) => api.supprimer(`${BASE}familles/${id}/`);

// --- Produits (liste paginée) ---

export const TAILLE_PAGE = 24;

/** Requête de la liste : `famille` (id), `enLigne` ('1' | '0' | ''), `recherche`, `page`, `taille`. */
export function requeteProduits({ famille = '', enLigne = '', recherche = '', page = 1, taille } = {}) {
  const params = new URLSearchParams();
  if (famille) params.set('famille', String(famille));
  if (enLigne === '1' || enLigne === '0') params.set('en_ligne', enLigne);
  if (recherche.trim()) params.set('search', recherche.trim());
  if (page > 1) params.set('page', String(page));
  if (taille) params.set('taille', String(taille));
  const texte = params.toString();
  return texte ? `${BASE}produits/?${texte}` : `${BASE}produits/`;
}

/** → { count, next, previous, results: [produit] } */
export const listerProduits = (criteres, { signal } = {}) => api.get(requeteProduits(criteres), { signal });

/** Produits proposés dans les listes de choix (réalisations, actualités, sphère) : 100 au plus. */
export const listerProduitsChoix = ({ signal } = {}) =>
  api.get(requeteProduits({ taille: 100 }), { signal }).then(resultats);

export const obtenirProduit = (id, { signal } = {}) => api.get(`${BASE}produits/${id}/`, { signal });
/** Champs du produit + traductions, caracteristiques et couches (listes remplacées en entier). */
export const creerProduit = (donnees) => api.post(`${BASE}produits/`, donnees);
export const modifierProduit = (id, donnees) => api.patch(`${BASE}produits/${id}/`, donnees);
export const supprimerProduit = (id) => api.supprimer(`${BASE}produits/${id}/`);

// --- Images d'un produit (la première est la vignette) ---

/** Multipart : image, alt, traductions → { id, url, alt, ordre, traductions } */
export const ajouterImage = (produitId, { fichier, alt = '', traductions = {} }) =>
  envoyer(`${BASE}produits/${produitId}/images/`, { alt, traductions }, { fichiers: { image: fichier } });
/** { alt?, ordre?, traductions? } */
export const modifierImage = (id, donnees) => api.patch(`${BASE}images/${id}/`, donnees);
export const supprimerImage = (id) => api.supprimer(`${BASE}images/${id}/`);

// --- Designs (coloris, motifs) ---

/** Multipart : nom, image?, couleur?, traductions? → { id, nom, image, couleur, ordre, traductions } */
export const ajouterDesign = (produitId, { fichier, ...donnees }) =>
  envoyer(`${BASE}produits/${produitId}/designs/`, donnees, { fichiers: { image: fichier } });
export const modifierDesign = (id, { fichier, ...donnees }) =>
  envoyer(`${BASE}designs/${id}/`, donnees, { methode: 'PATCH', fichiers: { image: fichier } });
export const supprimerDesign = (id) => api.supprimer(`${BASE}designs/${id}/`);
