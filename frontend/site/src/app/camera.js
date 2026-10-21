// Caméra de la scène : à chaque navigation, elle se DÉPLACE de son cadrage actuel vers celui de la nouvelle page
// (pan et zoom ensemble, avec un léger « push » au milieu du trajet qui retombe à l'arrivée), sans jamais repasser
// par le plan large. Seulement `transform`/`scale` (GPU). Les cadrages sont dans cameras.js.
//
// - Premier affichage (adresse directe) : cadrage direct, sans trajet.
// - `prefers-reduced-motion`, économie de données, appareil faible, navigateur sans animations Web : cadrage immédiat.
// - Un second clic en plein trajet reprend depuis la position courante de la caméra (lue sur l'élément).
// - Le trajet n'empêche jamais la navigation : aucun écouteur, aucun blocage des clics.
import { useLayoutEffect, useRef } from 'react';

import { cadrageDe, estTelephone, nomDeVue } from './cameras.js';
import { profondeurActive } from './preferences.js';

export const DUREE_TRAJET = 700; // ms
const PUSH = 1.12; // l'échelle gagne ~12 % au milieu du trajet

/** Lit `matrix(a, b, c, d, e, f)` : { tx, ty, echelle } en pixels (identité si « none »). */
export function lireMatrice(valeur) {
  const m = /matrix\(([^)]+)\)/.exec(valeur || '');
  if (!m) return { tx: 0, ty: 0, echelle: 1 };
  const [a, , , , e, f] = m[1].split(',').map(Number);
  return { tx: e, ty: f, echelle: a };
}

const transformCss = ({ tx, ty, echelle }) => `translate(${tx}px, ${ty}px) scale(${echelle})`;
const echelleCss = (v) => (v === 'none' || !v ? 1 : parseFloat(v));

/** Pose le cadrage sur la scène (variables CSS) et, si `animer`, y mène la caméra depuis sa position actuelle. */
export function deplacerCamera(scene, cadrage, { animer, vue }) {
  const image = scene.querySelector('.scene-image');
  if (!image) return null;
  const avant = getComputedStyle(image);
  const depart = {
    transform: lireMatrice(avant.transform),
    echelle: echelleCss(avant.scale),
    origine: avant.transformOrigin,
  };
  image.getAnimations?.().filter((a) => a.id === 'camera').forEach((a) => a.cancel());

  // La vue (data-cam) est posée ici, après la lecture du départ : l'accueil lie son zoom au défilement, et son état
  // (échelle, origine) doit pouvoir être lu avant de le quitter.
  if (vue) scene.parentElement.dataset.cam = vue;
  scene.style.setProperty('--cam-x', String(cadrage.x));
  scene.style.setProperty('--cam-y', String(cadrage.y));
  scene.style.setProperty('--cam-zoom', String(cadrage.zoom));
  if (!animer || typeof image.animate !== 'function') return null;

  const apres = getComputedStyle(image);
  const arrivee = {
    transform: lireMatrice(apres.transform),
    echelle: echelleCss(apres.scale),
    origine: apres.transformOrigin,
  };
  const milieu = {
    tx: (depart.transform.tx + arrivee.transform.tx) / 2,
    ty: (depart.transform.ty + arrivee.transform.ty) / 2,
    echelle: ((depart.transform.echelle + arrivee.transform.echelle) / 2) * PUSH,
  };
  return image.animate(
    [
      { transform: transformCss(depart.transform), scale: depart.echelle, transformOrigin: depart.origine },
      { transform: transformCss(milieu), scale: (depart.echelle + arrivee.echelle) / 2, transformOrigin: arrivee.origine, offset: 0.5 },
      { transform: transformCss(arrivee.transform), scale: arrivee.echelle, transformOrigin: arrivee.origine },
    ],
    { id: 'camera', duration: DUREE_TRAJET, easing: 'ease-in-out' },
  );
}

/** Crochet du gabarit : déplace la caméra à chaque changement de chemin. `refScene` : élément .scene. */
export function useCamera(chemin) {
  const refScene = useRef(null);
  const premier = useRef(true);
  useLayoutEffect(() => {
    const scene = refScene.current;
    if (!scene) return;
    const animer = !premier.current && profondeurActive();
    premier.current = false;
    deplacerCamera(scene, cadrageDe(chemin, estTelephone()), { animer, vue: nomDeVue(chemin) });
  }, [chemin]);
  // Démontage : le trajet en cours est annulé (pas de trajet orphelin ni de fuite). Effet à part : un nettoyage lié
  // au chemin annulerait le trajet avant que le suivant ne lise la position courante de la caméra.
  useLayoutEffect(() => {
    const scene = refScene.current; // retenu maintenant : la référence est vidée au démontage
    return () => {
      scene?.querySelector('.scene-image')?.getAnimations?.().filter((a) => a.id === 'camera').forEach((a) => a.cancel());
    };
  }, []);
  return refScene;
}
