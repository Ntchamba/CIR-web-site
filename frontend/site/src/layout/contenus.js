// Contenus de l'accueil (GET /api/contenus/accueil/) : titre, accroche, vidéo, bandeaux, sphère et
// coordonnées. Une seule requête par langue, partagée par l'en-tête, le pied de page et l'accueil.
import { useMemo } from 'react';

import { api } from '@/app/api.js';
import useDonnees from '@/app/useDonnees.js';
import { langueCourante } from '@/i18n/index.js';

import { fusionnerCoordonnees } from './coordonnees.js';

export const CHEMIN_CONTENUS_ACCUEIL = '/api/contenus/accueil/';

const cache = new Map(); // langue → promesse de la réponse

/** Contenus de l'accueil dans la langue courante (réponse gardée ; une erreur n'est pas gardée). */
export function chargerContenusAccueil() {
  const langue = langueCourante();
  if (!cache.has(langue)) {
    const promesse = api.get(CHEMIN_CONTENUS_ACCUEIL, { auth: false }).catch((erreur) => {
      cache.delete(langue);
      throw erreur;
    });
    cache.set(langue, promesse);
  }
  return cache.get(langue);
}

/** Vide le cache (tests, ou pour forcer un nouveau chargement). */
export function oublierContenusAccueil() {
  cache.clear();
}

/** `{ donnees, chargement, erreur, recharger }` ; rechargé quand la langue change. */
export function useContenusAccueil() {
  return useDonnees(() => chargerContenusAccueil(), []);
}

/** Coordonnées à afficher (API, sinon layout/coordonnees.js), même hors ligne. */
export function useCoordonnees() {
  const { donnees } = useContenusAccueil();
  const brutes = donnees?.coordonnees;
  return useMemo(() => fusionnerCoordonnees(brutes), [brutes]);
}
