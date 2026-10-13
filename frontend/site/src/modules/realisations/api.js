// BF-02, BF-03, BF-04 : réalisations, démonstrations, témoignages.
import { api, resultats } from '@/lib/api.js';

export const realisations = (type, signal) =>
  api.get(`/vitrine/realisations/?taille=60${type ? `&type_chantier=${type}` : ''}`, { auth: false, signal }).then(resultats);
export const demos = (signal) => api.get('/vitrine/demos/', { auth: false, signal });
export const temoignages = (signal) => api.get('/vitrine/temoignages/?taille=12', { auth: false, signal }).then(resultats);
export const proposerTemoignage = (donnees) => api.post('/vitrine/temoignages/', donnees);
