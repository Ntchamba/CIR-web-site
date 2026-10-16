// Client de l'API pour le tableau de bord (jetons rangés sous la clé « cir-tdb.jetons », distincte du site).
import { creerClientApi } from '@partage/api/client.js';

export const api = creerClientApi({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  cleStockage: 'cir-tdb',
});

export { CHEMINS, ErreurApi, erreursChamps, resultats } from '@partage/api/client.js';
