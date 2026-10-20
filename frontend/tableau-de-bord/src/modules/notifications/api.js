// BF-07, BF-13 : notifications de l'équipe (/api/admin/notifications/), voir docs/taches/vague-3-contrat-api.md.
import { api } from '@/app/api.js';

const BASE = '/api/admin/notifications/';

function requete(base, criteres = {}) {
  const params = new URLSearchParams();
  Object.entries(criteres).forEach(([cle, valeur]) => {
    if (cle === 'page') { if (valeur > 1) params.set('page', String(valeur)); } else if (valeur !== '' && valeur != null) params.set(cle, String(valeur));
  });
  const texte = params.toString();
  return texte ? `${base}?${texte}` : base;
}

/** → { count, next, previous, results: [{ id, type, titre, texte, lien, lue, cree_le }] } (textes dans la langue de la requête) */
export const listerNotifications = ({ lue = '', page = 1 } = {}, { signal } = {}) => api.get(requete(BASE, { lue, page }), { signal });
/** → { count } */
export const nonLues = ({ signal } = {}) => api.get(`${BASE}non-lues/`, { signal });
export const marquerLue = (id) => api.post(`${BASE}${encodeURIComponent(id)}/lue/`, {});
/** → { count: 0 } */
export const toutMarquerLu = () => api.post(`${BASE}lues/`, {});
/** → { email_equipe: bool } */
export const lirePreferences = ({ signal } = {}) => api.get(`${BASE}preferences/`, { signal });
export const modifierPreferences = (donnees) => api.patch(`${BASE}preferences/`, donnees);

// Super-administrateur seulement.
/** → tous les événements avec, par langue, le texte par défaut et le modèle enregistré (voir `modeles.js`). */
export const listerModeles = ({ signal } = {}) => api.get(`${BASE}modeles/`, { signal });
/** `{ sujet, introduction }` */
export const enregistrerModele = (evenement, langue, donnees) =>
  api.put(`${BASE}modeles/${encodeURIComponent(evenement)}/${encodeURIComponent(langue)}/`, donnees);
export const retablirModele = (evenement, langue) =>
  api.supprimer(`${BASE}modeles/${encodeURIComponent(evenement)}/${encodeURIComponent(langue)}/`);
/** `{ evenement, langue, sujet?, introduction? }` → { sujet, corps_html, corps_texte } (valeurs d'exemple) */
export const apercuModele = (donnees) => api.post(`${BASE}modeles/apercu/`, donnees);
/** `etat` : en_attente | envoye | echec | annule. */
export const listerEnvois = ({ etat = '', page = 1 } = {}, { signal } = {}) => api.get(requete(`${BASE}envois/`, { etat, page }), { signal });
/** → { en_attente, envoye, echec, annule, gmail_configure } */
export const resumeEnvois = ({ signal } = {}) => api.get(`${BASE}envois/resume/`, { signal });
export const reessayerEnvoi = (id) => api.post(`${BASE}envois/${encodeURIComponent(id)}/reessayer/`, {});
