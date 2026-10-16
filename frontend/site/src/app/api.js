// Client de l'API pour le site public (jetons rangés sous la clé « cir-site.jetons »).
import { creerClientApi } from '@partage/api/client.js';

export const api = creerClientApi({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  cleStockage: 'cir-site',
});

export { ErreurApi, erreursChamps, resultats } from '@partage/api/client.js';
