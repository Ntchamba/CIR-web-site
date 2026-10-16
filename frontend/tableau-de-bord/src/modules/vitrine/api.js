// BF-02, BF-03, BF-04, BF-15 : vitrine côté équipe (/api/admin/vitrine/), voir docs/taches/vague-1-contrat-api.md.
import { api, resultats } from '@/app/api.js';
import { envoyer } from '@/composants/envoi.js';

const BASE = '/api/admin/vitrine/';
export const TAILLE_LISTE = 100; // listes de l'équipe : les 100 premiers éléments
export const TAILLE_PAGE = 24;

/** Liste « courte » d'une ressource : { elements, total }. */
const listerCourt = (chemin, signal) => api.get(`${BASE}${chemin}?taille=${TAILLE_LISTE}`, { signal })
  .then((d) => ({ elements: resultats(d), total: typeof d?.count === 'number' ? d.count : resultats(d).length }));

// --- Réalisations (multipart pour les images ; produits = liste d'ids) ---
export const listerRealisations = ({ signal } = {}) => listerCourt('realisations/', signal);
export const creerRealisation = (donnees, fichiers) => envoyer(`${BASE}realisations/`, donnees, { fichiers });
export const modifierRealisation = (id, donnees, fichiers) =>
  envoyer(`${BASE}realisations/${id}/`, donnees, { methode: 'PATCH', fichiers });
export const supprimerRealisation = (id) => api.supprimer(`${BASE}realisations/${id}/`);

// --- Démos (vidéo envoyée ou lien YouTube / Vimeo) ---
export const listerDemos = ({ signal } = {}) => listerCourt('demos/', signal);
export const creerDemo = (donnees, fichiers) => envoyer(`${BASE}demos/`, donnees, { fichiers });
export const modifierDemo = (id, donnees, fichiers) => envoyer(`${BASE}demos/${id}/`, donnees, { methode: 'PATCH', fichiers });
export const supprimerDemo = (id) => api.supprimer(`${BASE}demos/${id}/`);

// --- Témoignages (modération) ---
export const STATUTS_TEMOIGNAGE = ['en_attente', 'publie', 'refuse'];

export function requeteTemoignages({ statut = '', page = 1, taille } = {}) {
  const params = new URLSearchParams();
  if (statut) params.set('statut', statut);
  if (page > 1) params.set('page', String(page));
  if (taille) params.set('taille', String(taille));
  const texte = params.toString();
  return texte ? `${BASE}temoignages/?${texte}` : `${BASE}temoignages/`;
}

/** → { count, next, previous, results: [{ …, auteur: { id, email, nom_complet } | null }] } */
export const listerTemoignages = (criteres, { signal } = {}) => api.get(requeteTemoignages(criteres), { signal });

/** Nombre de témoignages en attente de modération. */
export const compterEnAttente = ({ signal } = {}) => api.get(requeteTemoignages({ statut: 'en_attente', taille: 1 }), { signal })
  .then((d) => (typeof d?.count === 'number' ? d.count : resultats(d).length));

export const publierTemoignage = (id) => api.post(`${BASE}temoignages/${id}/publier/`, {});
/** `motif` facultatif, montré au client dans « Mes témoignages ». */
export const refuserTemoignage = (id, motif = '') => api.post(`${BASE}temoignages/${id}/refuser/`, motif ? { motif } : {});
export const supprimerTemoignage = (id) => api.supprimer(`${BASE}temoignages/${id}/`);
