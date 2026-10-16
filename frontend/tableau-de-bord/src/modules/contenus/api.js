// BF-15, O2 : contenus du site côté équipe (/api/admin/contenus/), voir docs/taches/vague-1-contrat-api.md.
import { api, resultats } from '@/app/api.js';
import { envoyer, versFormData } from '@/composants/envoi.js';

const BASE = '/api/admin/contenus/';
const estFichier = (valeur) => typeof Blob !== 'undefined' && valeur instanceof Blob;

// --- Accueil (enregistrement unique) ---

/** → { titre, accroche, video_fond, image_affiche, texte_partenaire, telephones, whatsapp, email, adresse, traductions, langues_incompletes } */
export const obtenirAccueil = ({ signal } = {}) => api.get(`${BASE}accueil/`, { signal });

/**
 * Enregistre l'accueil : les textes (et les retraits de fichiers) en JSON, puis, s'il y en a, les nouveaux fichiers
 * en multipart (la liste `telephones` reste ainsi en JSON). `fichiers` : { video_fond, image_affiche }.
 */
export async function modifierAccueil(donnees, fichiers = {}) {
  const corps = { ...donnees };
  Object.entries(fichiers).forEach(([cle, f]) => { if (f === null) corps[cle] = null; });
  let resultat = await api.patch(`${BASE}accueil/`, corps);
  const nouveaux = Object.fromEntries(Object.entries(fichiers).filter(([, f]) => estFichier(f)));
  if (Object.keys(nouveaux).length) {
    resultat = await api.envoyerFichiers(`${BASE}accueil/`, versFormData({}, nouveaux), { methode: 'PATCH' });
  }
  return resultat;
}

// --- Bandeaux (liste simple) ---

/** → [{ id, texte, lien, actif, debut, fin, ordre, traductions, langues_incompletes }] */
export const listerBandeaux = ({ signal } = {}) => api.get(`${BASE}bandeaux/`, { signal }).then(resultats);
export const creerBandeau = (donnees) => api.post(`${BASE}bandeaux/`, donnees);
export const modifierBandeau = (id, donnees) => api.patch(`${BASE}bandeaux/${id}/`, donnees);
export const supprimerBandeau = (id) => api.supprimer(`${BASE}bandeaux/${id}/`);

// --- Sphère de photos de l'accueil (liste simple, ordonnée) ---

/** → [{ id, image, alt, produit, ordre, traductions, langues_incompletes }] */
export const listerSphere = ({ signal } = {}) => api.get(`${BASE}sphere/`, { signal }).then(resultats);
export const ajouterPhotoSphere = (donnees, fichiers) => envoyer(`${BASE}sphere/`, donnees, { fichiers });
export const modifierPhotoSphere = (id, donnees, fichiers) =>
  envoyer(`${BASE}sphere/${id}/`, donnees, { methode: 'PATCH', fichiers });
export const supprimerPhotoSphere = (id) => api.supprimer(`${BASE}sphere/${id}/`);
/** Nouvel ordre des photos : liste complète des ids. */
export const ordonnerSphere = (ids) => api.post(`${BASE}sphere/ordre/`, { ids });
