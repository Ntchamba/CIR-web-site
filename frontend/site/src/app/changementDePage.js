// Changement de page : position de défilement, focus et annonce aux lecteurs d'écran.
//
// - Nouvelle page (lien, redirection) : retour en haut, sans défilement animé (`scroll-behavior: smooth` de la
//   feuille de style s'appliquerait sinon à `scrollTo`).
// - Retour / avance de l'historique : la position quittée est retrouvée (le contenu arrive parfois après le
//   premier rendu : on réessaie quelques instants, sauf si le visiteur reprend la main).
// - Le focus est replacé sur le contenu principal (jamais perdu dans la scène) et le titre de la nouvelle page est
//   annoncé dans une zone « status ».
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router';

const CLE = 'cir-site.defilement';
const DELAI_RETENTE = 2000; // ms
const DELAI_ANNONCE = 700; // ms : titre annoncé même si l'intitulé n'a pas changé

const lirePositions = () => {
  try {
    return JSON.parse(globalThis.sessionStorage?.getItem(CLE)) || {};
  } catch {
    return {};
  }
};
// Positions retenues (clé de l'entrée d'historique -> défilement), gardées aussi dans sessionStorage (rechargement).
let enMemoire = null;
const positions = () => (enMemoire ??= lirePositions());
export const oublierPositions = () => { enMemoire = null; };
const ecrirePositions = () => {
  try {
    globalThis.sessionStorage?.setItem(CLE, JSON.stringify(positions()));
  } catch {
    /* stockage plein ou interdit : la position n'est simplement pas retenue */
  }
};

/** Défilement instantané (jamais animé par `scroll-behavior: smooth`). */
const aller = (haut) => {
  if (typeof window.scrollTo === 'function') window.scrollTo({ top: haut, left: 0, behavior: 'instant' });
};

/** Crochet du gabarit : défilement, focus et annonce à chaque changement de page. `refPrincipal` : élément <main>. */
export function useChangementDePage(refPrincipal) {
  const { pathname, key } = useLocation();
  const type = useNavigationType();
  const [annonce, setAnnonce] = useState('');
  const dernierChemin = useRef(null); // défilement
  const cheminAnnonce = useRef(pathname); // focus et annonce
  const cleCourante = useRef(key);
  const restauration = useRef(null); // { annuler }

  // Défilement : on retient la position de la page courante (sauf pendant qu'on en restaure une autre).
  useEffect(() => {
    if (globalThis.history && 'scrollRestoration' in globalThis.history) globalThis.history.scrollRestoration = 'manual';
    const retenir = () => {
      if (restauration.current) return;
      positions()[cleCourante.current] = window.scrollY;
    };
    const ecrire = () => { retenir(); ecrirePositions(); };
    window.addEventListener('scroll', retenir, { passive: true });
    window.addEventListener('pagehide', ecrire);
    return () => {
      window.removeEventListener('scroll', retenir);
      window.removeEventListener('pagehide', ecrire);
      ecrire();
    };
  }, []);

  useLayoutEffect(() => {
    restauration.current?.annuler();
    cleCourante.current = key;
    const memeChemin = dernierChemin.current === pathname;
    const premierAffichage = dernierChemin.current === null;
    dernierChemin.current = pathname;
    const cible = type === 'POP' ? positions()[key] : undefined;
    if (typeof cible !== 'number' || cible <= 0) {
      // Filtre, recherche ou ancre (même page) : on ne bouge pas ; adresse directe : le navigateur est déjà en haut.
      if (!memeChemin && !(premierAffichage && type === 'POP')) aller(0);
      return undefined;
    }
    let id = 0;
    const debut = performance.now();
    const annuler = () => {
      cancelAnimationFrame(id);
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((e) => window.removeEventListener(e, annuler));
      restauration.current = null;
    };
    const tenter = () => {
      aller(cible);
      if (Math.abs(window.scrollY - cible) < 2 || performance.now() - debut > DELAI_RETENTE) annuler();
      else id = requestAnimationFrame(tenter);
    };
    restauration.current = { annuler };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((e) => window.addEventListener(e, annuler, { once: true, passive: true }));
    tenter();
    return annuler;
  }, [key, pathname, type]);

  // Focus et annonce : pas au tout premier affichage (le navigateur annonce déjà la page qu'il charge).
  useEffect(() => {
    if (cheminAnnonce.current === pathname) return undefined;
    cheminAnnonce.current = pathname;
    refPrincipal.current?.focus({ preventScroll: true });
    const titre = document.querySelector('title');
    let attente = true;
    const dire = () => {
      if (!attente) return;
      attente = false;
      setAnnonce(document.title);
    };
    // Le titre est posé par la page une fois chargée (chargement à la demande) : on l'attend, sinon délai.
    const observateur = titre && typeof MutationObserver === 'function' ? new MutationObserver(dire) : null;
    observateur?.observe(titre, { childList: true, characterData: true, subtree: true });
    const minuterie = window.setTimeout(dire, DELAI_ANNONCE);
    return () => {
      attente = false;
      observateur?.disconnect();
      window.clearTimeout(minuterie);
    };
  }, [pathname]);

  return annonce;
}
