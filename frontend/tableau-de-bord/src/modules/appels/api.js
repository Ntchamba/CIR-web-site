// BF-11 : appels vidéo et audio côté équipe (/api/admin/appels/), voir docs/taches/vague-3-contrat-api.md.
import { api } from '@/app/api.js';

const BASE = '/api/admin/appels/';

/** Requête de l'historique : `etat`, `recherche`, `page`. */
export function requeteAppels({ etat = '', recherche = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  if (etat) params.set('etat', etat);
  if (recherche.trim()) params.set('search', recherche.trim());
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return texte ? `${BASE}?${texte}` : BASE;
}

/** → { count, next, previous, results: [<Appel> + rappel: { telephone, lien_messagerie } pour les manqués] }
 *  <Appel> : { id, reference, type, etat, client: { id, nom_complet, telephone }, commande: { id, reference } | null,
 *  cree_le, demarre_le, termine_le, repondu_par: { id, nom_complet } | null, duree_secondes } */
export const listerAppels = (criteres, { signal } = {}) => api.get(requeteAppels(criteres), { signal });
/** → [<Appel>] qui sonnent */
export const appelsEnAttente = ({ signal } = {}) => api.get(`${BASE}en-attente/`, { signal });
/** → { appel, jitsi: { domaine, app_id, salle, jeton } } (jeton modérateur) */
export const repondreAppel = (id) => api.post(`${BASE}${encodeURIComponent(id)}/repondre/`, {});
export const refuserAppel = (id) => api.post(`${BASE}${encodeURIComponent(id)}/refuser/`, {});
export const terminerAppel = (id) => api.post(`${BASE}${encodeURIComponent(id)}/terminer/`, {});
/** → { mois, utilisateurs_actifs, limite_gratuite, depasse, proche } */
export const usageAppels = ({ signal } = {}) => api.get(`${BASE}usage/`, { signal });
/** → { en_attente, manques_non_vus } */
export const resumeAppels = ({ signal } = {}) => api.get(`${BASE}resume/`, { signal });
