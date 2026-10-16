// Préférences du visiteur lues dans le navigateur : mouvement réduit, économie de données.
import { useSyncExternalStore } from 'react';

const REQUETE_MOUVEMENT = '(prefers-reduced-motion: reduce)';

function media() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REQUETE_MOUVEMENT)
    : null;
}

function abonnerMouvement(rappel) {
  const m = media();
  if (!m) return () => {};
  m.addEventListener?.('change', rappel);
  return () => m.removeEventListener?.('change', rappel);
}

/** Vrai si le visiteur demande moins d'animations (réglage du système). */
export const mouvementReduit = () => Boolean(media()?.matches);

/** Vrai si le navigateur signale le mode « économie de données » (Chrome sur Android, notamment). */
export const economieDonnees = () => Boolean(globalThis.navigator?.connection?.saveData);

/** Crochet : redessine le composant si le réglage « mouvement réduit » change. */
export function useMouvementReduit() {
  return useSyncExternalStore(abonnerMouvement, mouvementReduit, () => false);
}
