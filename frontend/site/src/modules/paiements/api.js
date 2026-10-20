// BF-10, BF-12 : paiements du client connecté (/api/paiements/). Le serveur est seul juge de l'état d'un paiement :
// il revérifie chaque transaction auprès de CamPay. Le site n'affiche que ce qu'il reçoit.
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/** → { configure: boolean } : faux tant que CamPay n'est pas configuré (le bouton « Payer » reste masqué). */
export const disponibilite = ({ signal } = {}) => api.get('/api/paiements/disponibilite/', { signal });

/** Paginé, `?commande=<id>&etat=` : ses propres paiements. */
export const lister = (criteres = {}, { signal } = {}) => api.get(`/api/paiements/${requete(criteres)}`, { signal });

/**
 * { commande, mode?: 'mobile'|'lien', telephone?, montant? } → 201 paiement.
 * Erreurs : 400 (`montant`, `telephone`), 404, 409 `paiement_en_cours` / `paiement_non_autorise`, 429
 * `trop_de_paiements`, 503 `paiements_non_configures` / `paiements_indisponibles`.
 */
export const creer = (corps) => api.post('/api/paiements/', corps);

/** Un paiement ; en attente, le serveur le revérifie auprès de CamPay avant de répondre. */
export const detail = (id, { signal } = {}) => api.get(`/api/paiements/${id}/`, { signal });

/** Annule un paiement par lien encore en attente. */
export const annuler = (id) => api.post(`/api/paiements/${id}/annuler/`, {});

/** Reçu d'un paiement réussi (404 sinon). */
export const recu = (id, { signal } = {}) => api.get(`/api/paiements/${id}/recu/`, { signal });
