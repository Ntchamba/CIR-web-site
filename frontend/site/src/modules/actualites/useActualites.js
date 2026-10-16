// Actualités : liste paginée, trois dernières (accueil), détail.
import { resultats } from '@partage/api/client.js';

import useDonnees from '@/app/useDonnees.js';
import useListePaginee from '@/app/useListePaginee.js';

import * as api from './api.js';

export default function useActualites() {
  return useListePaginee(({ page, signal }) => api.actualites({ page: page > 1 ? page : '' }, { signal }), []);
}

/** Les `taille` dernières actualités (accueil). */
export function useDernieresActualites(taille = 3) {
  const etat = useDonnees(({ signal }) => api.actualites({ taille }, { signal }), [taille]);
  return { ...etat, actualites: resultats(etat.donnees) };
}

export function useActualite(slug) {
  const { donnees, chargement, erreur, recharger } = useDonnees(({ signal }) => api.actualite(slug, { signal }), [slug]);
  return { actualite: donnees, chargement, erreur, introuvable: erreur?.statut === 404, recharger };
}
