// BF-09 : sélection de produits du client connecté (/api/selection/). Réservée aux comptes clients.
import { api } from '@/app/api.js';

/** { count, elements: [{id, produit, design, ajoute_le, disponible}] } (50 au plus, sans pagination). */
export const lister = ({ signal } = {}) => api.get('/api/selection/', { signal });

/** { count, produits: [<id produit>] } : léger, pour marquer les boutons « Ajouter ». */
export const resume = ({ signal } = {}) => api.get('/api/selection/resume/', { signal });

/** 201 (ajouté) ou 200 (déjà dans la sélection). */
export const ajouter = (produit, design) =>
  api.post('/api/selection/', design ? { produit, design } : { produit });

export const retirer = (id) => api.supprimer(`/api/selection/${id}/`);

export const vider = () => api.supprimer('/api/selection/');
