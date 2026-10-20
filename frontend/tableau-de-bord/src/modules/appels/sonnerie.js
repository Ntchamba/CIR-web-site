// Sonnerie des appels entrants. Un navigateur n'autorise le son qu'après un geste de la personne :
// tant que le bouton « Activer la sonnerie » n'a pas été utilisé, l'appel est seulement signalé à l'écran.
// Son court généré par AudioContext (aucun fichier à télécharger). Module à état unique, lu par `useSonnerie`.
import { useSyncExternalStore } from 'react';

const DELAI_REPETITION = 2500; // ms entre deux sonneries

let contexte = null;
let actif = false;
let minuteur = null;
const abonnes = new Set();

const Constructeur = () => (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : undefined);
const prevenir = () => abonnes.forEach((rappel) => rappel());

export const sonnerieDisponible = () => typeof Constructeur() === 'function';

function bip(frequence, debut, duree) {
  const oscillateur = contexte.createOscillator();
  const gain = contexte.createGain();
  oscillateur.type = 'sine';
  oscillateur.frequency.value = frequence;
  gain.gain.setValueAtTime(0.0001, debut);
  gain.gain.exponentialRampToValueAtTime(0.25, debut + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  oscillateur.connect(gain);
  gain.connect(contexte.destination);
  oscillateur.start(debut);
  oscillateur.stop(debut + duree + 0.05);
}

function sonner() {
  if (!actif || !contexte || contexte.state !== 'running') return;
  const maintenant = contexte.currentTime;
  bip(880, maintenant, 0.25);
  bip(660, maintenant + 0.3, 0.25);
}

/** Activation par un geste (clic). Renvoie vrai si le navigateur autorise le son. */
export async function activerSonnerie() {
  const Ctor = Constructeur();
  if (typeof Ctor !== 'function') return false;
  try {
    contexte ??= new Ctor();
    await contexte.resume();
  } catch {
    return false;
  }
  actif = contexte.state === 'running';
  prevenir();
  return actif;
}

export function desactiverSonnerie() {
  actif = false;
  arreter();
  prevenir();
}

/** Sonne maintenant puis toutes les 2,5 s, tant que `arreter` n'est pas appelée. Sans effet si la sonnerie n'est pas activée. */
export function demarrer() {
  if (minuteur || !actif) return;
  sonner();
  minuteur = setInterval(sonner, DELAI_REPETITION);
}

export function arreter() {
  clearInterval(minuteur);
  minuteur = null;
}

/** Pour les tests : retour à l'état initial. */
export function reinitialiserSonnerie() {
  arreter();
  contexte = null;
  actif = false;
  prevenir();
}

/** État lu par les composants : { disponible, active }. */
let instantane = { disponible: false, active: false };
function lireEtat() {
  const disponible = sonnerieDisponible();
  if (instantane.disponible !== disponible || instantane.active !== actif) instantane = { disponible, active: actif };
  return instantane;
}
const abonner = (rappel) => { abonnes.add(rappel); return () => abonnes.delete(rappel); };

export function useSonnerie() {
  return useSyncExternalStore(abonner, lireEtat, lireEtat);
}
