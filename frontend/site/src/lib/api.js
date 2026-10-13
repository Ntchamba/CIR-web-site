// Client de l'API pour le site public (jetons rangés sous la clé « cir-site »).
import { creerClientApi } from '@shared/api/client.js';

export const api = creerClientApi({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  cleStockage: 'cir-site',
});

export { ErreurApi, resultats } from '@shared/api/client.js';
