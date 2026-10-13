// BF-01, BF-05 : appels à l'API du catalogue.
import { api } from '@/lib/api.js';

export const familles = (signal) => api.get('/catalogue/familles/', { auth: false, signal });

export function produits({ famille, usage, recherche, page = 1 }, signal) {
  const p = new URLSearchParams({ page: String(page) });
  if (famille) p.set('famille', famille);
  if (usage) p.set('usage', usage);
  if (recherche) p.set('search', recherche);
  return api.get(`/catalogue/produits/?${p}`, { auth: false, signal });
}

export const produit = (slug, signal) => api.get(`/catalogue/produits/${slug}/`, { auth: false, signal });
