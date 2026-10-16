/**
 * Traductions de l'interface, communes au site public et au tableau de bord (sans bibliothèque externe).
 *
 * - Les messages sont des objets imbriqués ; une clé est un chemin pointé : t('compte.connexion.titre').
 * - Le français est chargé avec l'application (langue de référence et de secours) ; les autres langues
 *   sont chargées à la demande (un petit fichier par langue, BNF-02).
 * - Variables : t('equipe.ajoute', { nom: 'Awa' }) remplace « {nom} ». Les nombres sont mis en forme
 *   selon la langue.
 * - Pluriels : un message peut être un objet { zero?, one, other } ; la forme est choisie d'après la
 *   variable `n` (règles Intl.PluralRules de la langue).
 * - `t` fonctionne aussi hors des composants (client API, mise en forme) ; dans un composant, utiliser
 *   le crochet useTraduction() pour être redessiné au changement de langue.
 *
 * Usage dans une application (voir frontend/partage/README.md) :
 *   enregistrerMessages('fr', messagesFr);                       // au chargement du module i18n de l'appli
 *   enregistrerChargeurs({ en: () => import('./en.js'), ... });  // langues chargées à la demande
 *   await demarrerI18n({ cleStockage: 'cir-site' });             // dans main.jsx, avant le premier rendu
 */
import { CODES_LANGUES, infosLangue, LANGUE_PAR_DEFAUT, langueGeree } from './langues.js';
import messagesCommunsFr from './messages/fr.js';

/** Messages communs (dossier partage) des autres langues, chargés à la demande. */
const CHARGEURS_COMMUNS = {
  en: () => import('./messages/en.js'),
  zh: () => import('./messages/zh.js'),
  de: () => import('./messages/de.js'),
  ja: () => import('./messages/ja.js'),
};

const etat = {
  langue: LANGUE_PAR_DEFAUT,
  messages: Object.fromEntries(CODES_LANGUES.map((code) => [code, {}])),
  chargeurs: [CHARGEURS_COMMUNS], // un objet { code: () => import(...) } par source de messages
  chargees: new Set([LANGUE_PAR_DEFAUT]),
  cleStockage: 'cir',
};
const abonnes = new Set();

function fusionner(cible, source) {
  Object.entries(source || {}).forEach(([cle, valeur]) => {
    const estObjet = valeur && typeof valeur === 'object' && !Array.isArray(valeur) && !estPluriel(valeur);
    if (estObjet) {
      if (!cible[cle] || typeof cible[cle] !== 'object') cible[cle] = {};
      fusionner(cible[cle], valeur);
    } else {
      cible[cle] = valeur;
    }
  });
  return cible;
}

const FORMES_PLURIEL = ['zero', 'one', 'two', 'few', 'many', 'other'];
function estPluriel(valeur) {
  return typeof valeur === 'object' && valeur !== null && typeof valeur.other === 'string'
    && Object.keys(valeur).every((k) => FORMES_PLURIEL.includes(k));
}

/** Ajoute des messages à une langue (les clés existantes sont remplacées). */
export function enregistrerMessages(code, messages) {
  if (!etat.messages[code]) return;
  fusionner(etat.messages[code], messages?.default ?? messages);
}

/** Ajoute une source de messages chargés à la demande : { en: () => import('./en.js'), ... }. */
export function enregistrerChargeurs(chargeurs) {
  if (chargeurs && !etat.chargeurs.includes(chargeurs)) etat.chargeurs.push(chargeurs);
}

function chercher(code, cle) {
  let noeud = etat.messages[code];
  for (const morceau of cle.split('.')) {
    if (noeud === undefined || noeud === null || typeof noeud !== 'object') return undefined;
    noeud = noeud[morceau];
  }
  return noeud;
}

function choisirForme(message, variables, langue) {
  const n = Number(variables?.n);
  if (n === 0 && message.zero !== undefined) return message.zero;
  const forme = Number.isFinite(n) ? new Intl.PluralRules(infosLangue(langue).intl).select(n) : 'other';
  return message[forme] ?? message.other;
}

function remplacer(texte, variables, langue) {
  if (!variables) return texte;
  return texte.replace(/\{(\w+)\}/g, (tout, nom) => {
    if (!(nom in variables)) return tout;
    const valeur = variables[nom];
    if (typeof valeur === 'number') return new Intl.NumberFormat(infosLangue(langue).intl).format(valeur);
    return String(valeur ?? '');
  });
}

/**
 * Texte traduit de `cle` dans la langue courante, sinon en français, sinon la clé elle-même
 * (une clé visible à l'écran signale une traduction oubliée).
 */
export function t(cle, variables) {
  const langue = etat.langue;
  let message = chercher(langue, cle);
  let langueDuTexte = langue;
  if (message === undefined || (typeof message === 'object' && !estPluriel(message))) {
    message = chercher(LANGUE_PAR_DEFAUT, cle);
    langueDuTexte = LANGUE_PAR_DEFAUT;
  }
  if (message === undefined || message === null) return cle;
  if (estPluriel(message)) message = choisirForme(message, variables, langueDuTexte);
  if (typeof message !== 'string') return cle;
  return remplacer(message, variables, langue);
}

/** Vrai si la clé existe (dans la langue courante ou en français). */
export function existe(cle) {
  return chercher(etat.langue, cle) !== undefined || chercher(LANGUE_PAR_DEFAUT, cle) !== undefined;
}

export const langueCourante = () => etat.langue;
/** Locale Intl de la langue courante (« fr-FR », « ja-JP »…), pour les nombres et les dates. */
export const localeIntl = () => infosLangue(etat.langue).intl;
/** Valeur de l'en-tête Accept-Language envoyé au back-end. */
export const langueApi = () => infosLangue(etat.langue).api;

/** Appelle `rappel(langue)` à chaque changement de langue ; renvoie la fonction de désabonnement. */
export function abonner(rappel) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

async function charger(code) {
  if (etat.chargees.has(code)) return;
  const modules = await Promise.all(etat.chargeurs.map((source) => source[code]?.()).filter(Boolean));
  modules.forEach((m) => enregistrerMessages(code, m));
  etat.chargees.add(code);
}

function lireStockage() {
  try {
    return localStorage.getItem(`${etat.cleStockage}.langue`);
  } catch {
    return null;
  }
}

function ecrireStockage(code) {
  try {
    localStorage.setItem(`${etat.cleStockage}.langue`, code);
  } catch {
    /* stockage indisponible (navigation privée) : le choix ne survivra pas au rechargement */
  }
}

function appliquerAuDocument(code) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = infosLangue(code).html;
  }
}

/**
 * Change la langue de l'interface : charge ses messages si besoin, puis prévient les abonnés.
 * `retenir` (par défaut) : le choix est gardé dans le navigateur pour les prochaines visites.
 * Renvoie le code appliqué (le français si le code demandé n'est pas proposé).
 */
export async function changerLangue(code, { retenir = true } = {}) {
  const cible = langueGeree(code) || LANGUE_PAR_DEFAUT;
  try {
    await charger(cible);
  } catch {
    // Fichier de messages injoignable (réseau coupé) : on reste dans la langue actuelle.
    return etat.langue;
  }
  if (retenir) ecrireStockage(cible);
  if (cible !== etat.langue) {
    etat.langue = cible;
    appliquerAuDocument(cible);
    abonnes.forEach((rappel) => rappel(cible));
  }
  return cible;
}

/**
 * Langue à utiliser à l'ouverture : paramètre ?lang= de l'adresse, puis choix déjà fait dans ce
 * navigateur, puis langues préférées du navigateur, puis le français.
 */
export function detecterLangue({ recherche, stockee, preferees } = {}) {
  const parametre = new URLSearchParams(recherche ?? globalThis.location?.search ?? '').get('lang');
  const navigateur = preferees ?? globalThis.navigator?.languages ?? [globalThis.navigator?.language];
  const candidats = [parametre, stockee !== undefined ? stockee : lireStockage(), ...(navigateur || [])];
  for (const candidat of candidats) {
    const code = langueGeree(candidat);
    if (code) return code;
  }
  return LANGUE_PAR_DEFAUT;
}

/**
 * À appeler une fois dans main.jsx, avant le premier rendu : retient la clé de stockage de l'application,
 * détecte la langue et charge ses messages (pas de texte français affiché un instant puis remplacé).
 */
export async function demarrerI18n({ cleStockage } = {}) {
  if (cleStockage) etat.cleStockage = cleStockage;
  const code = detecterLangue();
  const viaParametre = Boolean(new URLSearchParams(globalThis.location?.search ?? '').get('lang'));
  appliquerAuDocument(etat.langue);
  // Un lien partagé avec ?lang= devient le choix du visiteur ; la détection seule n'est pas retenue.
  return changerLangue(code, { retenir: viaParametre });
}

/** Tests : remet la langue par défaut sans prévenir les abonnés. */
export function reinitialiserI18n() {
  etat.langue = LANGUE_PAR_DEFAUT;
  appliquerAuDocument(LANGUE_PAR_DEFAUT);
}

enregistrerMessages(LANGUE_PAR_DEFAUT, messagesCommunsFr);
