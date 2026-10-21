// Entrée en profondeur (décision 11) : bascule « à plat » et zoom avant entre les pages.
//
// La profondeur elle-même est du CSS pur (styles/profondeur.css, `animation-timeline`) : aucun JavaScript
// ne tourne au défilement. Ce fichier ne fait que deux choses :
//  - poser l'attribut `data-plat` sur <html> quand la page doit rester à plat (navigateur sans prise en charge,
//    mouvement réduit, économie de données, appareil faible) : le CSS ne s'applique alors pas ;
//  - demander l'API View Transitions pour les changements de page (zoom avant), quand elle existe.
import { useEffect } from 'react';

import { profondeurActive, transitionPossible, useMouvementReduit } from './preferences.js';

/** Pose ou retire `data-plat` sur <html> selon les préférences ; se met à jour si le réglage système change. */
export function appliquerProfondeur(racine = document.documentElement) {
  const plat = !profondeurActive();
  racine.toggleAttribute('data-plat', plat);
  return !plat;
}

/** Crochet du gabarit : garde `data-plat` à jour. */
export function useProfondeur() {
  const reduit = useMouvementReduit();
  useEffect(() => {
    appliquerProfondeur();
    return () => document.documentElement.removeAttribute('data-plat');
  }, [reduit]);
}

/** Chemin cible d'une navigation (absolu seulement), sinon null : les liens relatifs ne font pas de zoom. */
function cheminCible(vers) {
  const brut = typeof vers === 'string' ? vers : vers?.pathname;
  if (typeof brut !== 'string' || !brut.startsWith('/')) return null;
  return brut.split(/[?#]/)[0];
}

/**
 * Fait de chaque changement de page (nouveau chemin, hors retour arrière et remplacement) un zoom avant
 * lorsque l'API View Transitions existe. Les filtres et recherches (même chemin) n'animent rien.
 */
export function activerZoomEntrePages(routeur) {
  const naviguer = routeur.navigate.bind(routeur);
  routeur.navigate = (vers, options) => {
    if (typeof vers === 'number' || options?.replace || options?.viewTransition !== undefined) return naviguer(vers, options);
    const cible = cheminCible(vers);
    const zoom = cible !== null && cible !== routeur.state.location.pathname && transitionPossible();
    return naviguer(vers, zoom ? { ...options, viewTransition: true } : options);
  };
  return routeur;
}
