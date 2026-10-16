// Vitrine : réalisations (filtrées par type de chantier), démos, témoignages publiés, témoignages du client.
import useDonnees from '@/app/useDonnees.js';
import useListePaginee from '@/app/useListePaginee.js';

import * as api from './api.js';

const page = (n) => (n > 1 ? n : '');

export function useRealisations(type = '', taille = '') {
  return useListePaginee(({ page: n, signal }) => api.realisations({ type, taille, page: page(n) }, { signal }), [type, taille]);
}

export function useDemos() {
  return useListePaginee(({ page: n, signal }) => api.demos({ page: page(n) }, { signal }), []);
}

export function useTemoignages() {
  return useListePaginee(({ page: n, signal }) => api.temoignages({ page: page(n) }, { signal }), []);
}

/** Témoignages du client connecté (rien à charger pour un visiteur). */
export function useMesTemoignages(connecte) {
  return useDonnees(({ signal }) => (connecte ? api.mesTemoignages({ signal }) : null), [connecte]);
}
