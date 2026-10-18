// BF-11, BF-13 : demandes de contact (/api/contact/demandes/). L'envoi est public (visiteur ou client).
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/**
 * { nom?, email?, telephone?, type: 'question'|'rappel', creneau?, message, produit?, site_web } → 201 {id, reference}.
 * `site_web` est le champ piège : il reste vide pour une vraie personne. Le jeton est joint s'il y en a un
 * (un client connecté peut omettre ses coordonnées). 429 : quotas.
 */
export const envoyer = (corps) => api.post('/api/contact/demandes/', corps);

/** Client connecté, paginé : [{id, reference, type, creneau, message, produit: {slug, nom}|null, etat, reponse_equipe, cree_le, traitee_le}] */
export const miennes = (criteres = {}, { signal } = {}) =>
  api.get(`/api/contact/demandes/miennes/${requete(criteres)}`, { signal });
