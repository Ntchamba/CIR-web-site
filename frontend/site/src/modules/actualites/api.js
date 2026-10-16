// BF-07 : actualités publiques (/api/actualites/), de la plus récente à la plus ancienne.
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/** { page, taille } → { count, next, previous, results: [{id, slug, titre, resume, texte, image, produit, publie_le}] } */
export const actualites = (criteres = {}, { signal } = {}) =>
  api.get(`/api/actualites/${requete(criteres)}`, { auth: false, signal });

export const actualite = (slug, { signal } = {}) =>
  api.get(`/api/actualites/${encodeURIComponent(slug)}/`, { auth: false, signal });
