// Client de l'API pour le tableau de bord (jetons de l'équipe rangés à part, sous « cir-equipe »).
import { creerClientApi } from '@shared/api/client.js';

export const api = creerClientApi({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  cleStockage: 'cir-equipe',
});

export const URL_SITE = import.meta.env.VITE_SITE_URL || 'http://localhost:5173';

export { ErreurApi, resultats } from '@shared/api/client.js';
