// Outils du contenu multilingue saisi par l'équipe (fiche docs/decisions/7-multilingue.md).
// Le français est dans les champs habituels ; les autres langues dans `traductions` :
//   { en: { nom: '…' }, zh: { … }, de: { … }, ja: { … } }
import { infosLangue, LANGUES } from '@partage/i18n/langues.js';

export const LANGUE_REFERENCE = 'fr';
export const AUTRES_LANGUES = LANGUES.map((l) => l.code).filter((code) => code !== LANGUE_REFERENCE);

const rempli = (texte) => typeof texte === 'string' && texte.trim() !== '';

/** Texte d'un champ dans une autre langue ('' s'il manque). */
export function texteTraduit(traductions, langue, champ) {
  const texte = traductions?.[langue]?.[champ];
  return typeof texte === 'string' ? texte : '';
}

/**
 * Nouvel objet `traductions` où `champ` vaut `texte` dans `langue`.
 * Les textes vides et les langues vides sont retirés (le serveur fait de même).
 */
export function modifierTraduction(traductions, langue, champ, texte) {
  const copie = { ...(traductions || {}) };
  const textes = { ...(copie[langue] || {}) };
  if (rempli(texte)) textes[champ] = texte;
  else delete textes[champ];
  if (Object.keys(textes).length) copie[langue] = textes;
  else delete copie[langue];
  return copie;
}

/**
 * Langues où il manque au moins une traduction d'un champ rempli en français
 * (même règle que `langues_incompletes` côté serveur, calculée pendant la saisie).
 * `objets` : un objet ou une liste d'objets ayant leurs champs français et leur `traductions`.
 */
export function languesIncompletes(objets, champs) {
  const liste = Array.isArray(objets) ? objets : [objets];
  return AUTRES_LANGUES.filter((code) => liste.some((objet) => champs.some(
    (champ) => rempli(objet?.[champ]) && !rempli(texteTraduit(objet?.traductions, code, champ)),
  )));
}

/** Nom d'une langue écrit dans cette langue (« English », « 中文 »…). */
export const nomLangue = (code) => infosLangue(code).nom;
