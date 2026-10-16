// BF-17 : comptes clients en lecture (/api/admin/comptes/clients/), réservé à l'équipe.
import { api } from '@/app/api.js';

const BASE = '/api/admin/comptes/clients/';

/** Construit la requête : `search` (nom, e-mail, téléphone, ville, quartier), `ville` (exacte), `page`. */
export function requeteClients({ recherche = '', ville = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  if (recherche.trim()) params.set('search', recherche.trim());
  if (ville.trim()) params.set('ville', ville.trim());
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return texte ? `${BASE}?${texte}` : BASE;
}

/** → { count, next, previous, results: [{ id, email, nom_complet, telephone, ville, quartier, adresse_complete, actif, date_inscription }] } */
export const listerClients = (criteres, { signal } = {}) => api.get(requeteClients(criteres), { signal });

/** Fiche : champs de la liste + rue_ou_repere, adresse_formatee, derniere_connexion. */
export const obtenirClient = (id, { signal } = {}) => api.get(`${BASE}${encodeURIComponent(id)}/`, { signal });
