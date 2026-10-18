// BF-11, BF-13 : demandes de contact côté équipe (/api/admin/contact/demandes/), voir docs/taches/vague-2-contrat-api.md.
import { api } from '@/app/api.js';

const BASE = '/api/admin/contact/demandes/';

/** Requête de la liste : `etat`, `type`, `recherche`, `page`. */
export function requeteDemandes({ etat = '', type = '', recherche = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  if (etat) params.set('etat', etat);
  if (type) params.set('type', type);
  if (recherche.trim()) params.set('search', recherche.trim());
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return texte ? `${BASE}?${texte}` : BASE;
}

/** → { count, next, previous, results: [{ id, reference, nom, email, telephone, type, creneau, message, produit, langue, etat,
 *  reponse_equipe, notes_internes, auteur: { id, nom_complet } | null, cree_le, traitee_le }] } */
export const listerDemandes = (criteres, { signal } = {}) => api.get(requeteDemandes(criteres), { signal });
export const obtenirDemande = (id, { signal } = {}) => api.get(`${BASE}${encodeURIComponent(id)}/`, { signal });
/** `{ etat?, reponse_equipe?, notes_internes? }` (`traitee_le` est posé par le serveur). */
export const modifierDemande = (id, donnees) => api.patch(`${BASE}${id}/`, donnees);
/** → { nouvelle, en_cours, traitee, total } */
export const resumeDemandes = ({ signal } = {}) => api.get(`${BASE}resume/`, { signal });
