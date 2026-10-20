// BF-11 : appels audio et vidéo du client (/api/appels/). Seul un client lance un appel ; l'équipe répond.
import { api } from '@/app/api.js';

/** → {configure: bool, equipe_en_ligne: bool} (jamais le nombre exact de personnes en ligne). */
export const disponibilite = ({ signal } = {}) => api.get('/api/appels/disponibilite/', { signal });

/**
 * {type: 'audio'|'video', commande?} → 201 {appel, jitsi: {domaine, app_id, salle, jeton}}.
 * Erreurs : 503 `appels_non_configures`, 409 `appel_deja_en_cours` ou `equipe_indisponible`, 429 (5 appels par heure).
 */
export const lancer = (corps) => api.post('/api/appels/', corps);

/** État actuel (le serveur applique l'expiration à 60 s) → {appel} */
export const lire = (id, { signal } = {}) => api.get(`/api/appels/${id}/`, { signal });

export const annuler = (id) => api.post(`/api/appels/${id}/annuler/`, {});

export const terminer = (id) => api.post(`/api/appels/${id}/terminer/`, {});
