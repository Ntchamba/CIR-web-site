// BF-10, BF-12, BF-13, BF-16 : commandes du client connecté (/api/commandes/). Les étapes et les actions possibles
// viennent du serveur : le site ne recalcule aucune règle.
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/** Paginé, `?etat=` : [{id, reference, type_batiment, etat, surface_m2, nombre_lignes, montant_convenu, action_requise, modifie_le, cree_le}] */
export const lister = (criteres = {}, { signal } = {}) => api.get(`/api/commandes/${requete(criteres)}`, { signal });

/**
 * { type_batiment, surface_m2?, description?, lignes?: [{produit, design?}], depuis_selection? } → 201 détail.
 * 403 `adresse_incomplete` (adresse du compte à compléter) ou `compte_equipe` ; 429 (5 par jour).
 */
export const creer = (corps) => api.post('/api/commandes/', corps);

/** Détail : adresse, lignes, propositions, historique, contrat, devis, `actions_possibles`, `action_requise`. */
export const detail = (id, { signal } = {}) => api.get(`/api/commandes/${id}/`, { signal });

/** { surface_m2?, description? } : seulement à l'étape « Nouvelle ». */
export const modifier = (id, corps) => api.patch(`/api/commandes/${id}/`, corps);

export const annuler = (id, motif) => api.post(`/api/commandes/${id}/annuler/`, motif ? { motif } : {});

/** { prix_m2?, total?, delai_jours?, message? } → 201 proposition. */
export const proposer = (id, corps) => api.post(`/api/commandes/${id}/propositions/`, corps);

/** Réponse à une proposition de l'équipe → détail de la commande. */
export const accepter = (id, propositionId, message) =>
  api.post(`/api/commandes/${id}/propositions/${propositionId}/accepter/`, message ? { message } : {});

export const refuser = (id, propositionId, message) =>
  api.post(`/api/commandes/${id}/propositions/${propositionId}/refuser/`, message ? { message } : {});
