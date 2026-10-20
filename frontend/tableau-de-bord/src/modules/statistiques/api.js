// BF-16 : statistiques de l'équipe (/api/admin/statistiques/), voir docs/taches/vague-4-contrat-api.md.
import { api } from '@/app/api.js';

const BASE = '/api/admin/statistiques/';

/**
 * Indicateurs d'une période (`du`, `au` : AAAA-MM-JJ ; sans paramètre, le serveur prend les 30 derniers jours).
 * → { periode, commandes, a_traiter, montants (null pour un membre simple), top_produits }
 */
export function resumeStatistiques({ du, au } = {}, { signal } = {}) {
  const params = new URLSearchParams();
  if (du) params.set('du', du);
  if (au) params.set('au', au);
  const texte = params.toString();
  return api.get(texte ? `${BASE}resume/?${texte}` : `${BASE}resume/`, { signal });
}

/** → { mois: [{ mois: '2026-10', commandes, signees, encaisse (null pour un membre simple) }] }, du plus ancien au plus récent. */
export const evolutionStatistiques = (mois = 12, { signal } = {}) => api.get(`${BASE}evolution/?mois=${mois}`, { signal });
