// BF-01, BF-05, BF-06 : fiche d'un produit (GET /api/catalogue/produits/<slug>/), 404 si hors ligne.
import { api } from '@/app/api.js';

export const produit = (slug, { signal } = {}) =>
  api.get(`/api/catalogue/produits/${encodeURIComponent(slug)}/`, { auth: false, signal });
