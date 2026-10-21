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

/** Vrai si le navigateur sait lier une animation CSS à la position de défilement (`animation-timeline`). */
export const defilementLiePossible = () =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline: view()');

/** Vrai sur un appareil peu puissant (mémoire de 1 Go ou moins, ou un seul cœur). */
export const appareilFaible = () => {
  const n = globalThis.navigator;
  if (!n) return false;
  return (typeof n.deviceMemory === 'number' && n.deviceMemory <= 1)
    || (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 1);
};

/**
 * Entrée en profondeur (décision 11) : active seulement si le navigateur sait lier l'animation au défilement
 * et si le visiteur n'a demandé ni moins d'animations, ni l'économie de données, sur un appareil assez puissant.
 * Sinon la page reste à plat, entière et dans l'ordre du document.
 */
export const profondeurActive = () =>
  defilementLiePossible() && !mouvementReduit() && !economieDonnees() && !appareilFaible();

/** Vrai si un zoom avant entre deux pages (API View Transitions) est possible et souhaité. */
export const transitionPossible = () =>
  typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
  && !mouvementReduit() && !economieDonnees() && !appareilFaible();

const REQUETE_TELEPHONE = '(max-width: 900px)';
const mediaTelephone = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REQUETE_TELEPHONE) : null);

/** Crochet : vrai en affichage téléphone (mêmes 900 px que la barre d'onglets et les feuilles de style). */
export function useEcranTelephone() {
  return useSyncExternalStore(
    (rappel) => {
      const m = mediaTelephone();
      m?.addEventListener?.('change', rappel);
      return () => m?.removeEventListener?.('change', rappel);
    },
    () => Boolean(mediaTelephone()?.matches),
    () => false,
  );
}
