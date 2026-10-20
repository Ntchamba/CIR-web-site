// BF-10, BF-12, BF-13, BF-16 : commandes côté équipe (/api/admin/commandes/), voir docs/taches/vague-2-contrat-api.md.
import { api } from '@/app/api.js';

const BASE = '/api/admin/commandes/';

/** Requête de la liste : `etat`, `recherche` (référence, nom, e-mail, téléphone), `actionRequise` ('1'), `type`, `client` (identifiant), `page`. */
export function requeteCommandes({ etat = '', recherche = '', actionRequise = '', type = '', client = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  if (client) params.set('client', String(client));
  if (etat) params.set('etat', etat);
  if (type) params.set('type', type);
  if (recherche.trim()) params.set('search', recherche.trim());
  if (actionRequise === '1') params.set('action_requise', '1');
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return texte ? `${BASE}?${texte}` : BASE;
}

/** → { count, next, previous, results: [{ id, reference, type_batiment, etat, surface_m2, nombre_lignes, montant_convenu,
 *  client: { id, nom_complet, email, telephone, ville }, action_requise, modifie_le, cree_le }] } */
export const listerCommandes = (criteres, { signal } = {}) => api.get(requeteCommandes(criteres), { signal });

/** → { nouvelle, negociation, contrat_signe, travaux, terminee, annulee, total, action_requise } */
export const resumeCommandes = ({ signal } = {}) => api.get(`${BASE}resume/`, { signal });

export const obtenirCommande = (id, { signal } = {}) => api.get(`${BASE}${encodeURIComponent(id)}/`, { signal });

/** `{ surface_m2?, notes_internes? }` → détail. */
export const modifierCommande = (id, donnees) => api.patch(`${BASE}${id}/`, donnees);

/** `etat` : 'travaux' | 'terminee' | 'annulee' seulement (le serveur refuse le reste) ; `motif` facultatif. */
export const changerEtat = (id, etat, motif) => api.post(`${BASE}${id}/etat/`, motif ? { etat, motif } : { etat });

/** `{ prix_m2?, total?, delai_jours?, message? }` → Proposition (201). */
export const proposer = (id, donnees) => api.post(`${BASE}${id}/propositions/`, donnees);

/** Accepter ou refuser une proposition de l'autre partie → détail de la commande. */
export const accepterProposition = (id, propositionId, message) =>
  api.post(`${BASE}${id}/propositions/${propositionId}/accepter/`, message ? { message } : {});
export const refuserProposition = (id, propositionId, message) =>
  api.post(`${BASE}${id}/propositions/${propositionId}/refuser/`, message ? { message } : {});
