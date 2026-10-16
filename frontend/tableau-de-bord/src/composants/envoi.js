// Envoi d'un formulaire du tableau de bord : JSON s'il n'y a pas de nouveau fichier, sinon multipart.
// En multipart, les objets et listes (traductions, caracteristiques, couches, produits…) partent en chaînes JSON
// et `null` part en chaîne vide (DRF la lit comme null pour un champ facultatif).
import { erreursChamps } from '@partage/api/client.js';

import { api } from '@/app/api.js';

const estFichier = (valeur) => typeof Blob !== 'undefined' && valeur instanceof Blob;

/** FormData des champs et des fichiers (`undefined` : champ non envoyé). */
export function versFormData(donnees = {}, fichiers = {}) {
  const formulaire = new FormData();
  Object.entries(donnees).forEach(([cle, valeur]) => {
    if (valeur === undefined) return;
    if (valeur === null) formulaire.append(cle, '');
    else if (typeof valeur === 'object') formulaire.append(cle, JSON.stringify(valeur));
    else formulaire.append(cle, String(valeur));
  });
  Object.entries(fichiers).forEach(([cle, fichier]) => {
    if (estFichier(fichier)) formulaire.append(cle, fichier, fichier.name || cle);
    else if (fichier === null) formulaire.append(cle, '');
  });
  return formulaire;
}

/**
 * Envoie `donnees` à `chemin`. `fichiers` : { champ: File (nouveau) | null (retirer) | undefined (inchangé) }.
 * Renvoie la réponse du serveur.
 */
export function envoyer(chemin, donnees, { fichiers = {}, methode = 'POST' } = {}) {
  if (Object.values(fichiers).some(estFichier)) {
    return api.envoyerFichiers(chemin, versFormData(donnees, fichiers), { methode });
  }
  const corps = { ...donnees };
  Object.entries(fichiers).forEach(([cle, fichier]) => {
    if (fichier === null) corps[cle] = null;
  });
  return api.requete(chemin, { methode, corps });
}

/**
 * Sépare une erreur d'envoi : erreurs par champ (affichées sous les champs connus) et erreur générale
 * (affichée en haut du formulaire si aucun champ connu n'est concerné).
 */
export function repartirErreur(erreur, champsConnus) {
  const champs = erreursChamps(erreur);
  const connu = Object.keys(champs).some((cle) => champsConnus.includes(cle));
  return { champs, generale: connu ? null : erreur };
}

/** Prix saisi (« 12500 », « 12 500 ») → entier, ou null s'il est vide (« Prix sur devis »). */
export function lirePrix(saisie) {
  const texte = String(saisie ?? '').replace(/[\s  ]/g, '');
  if (!texte) return null;
  const valeur = Number(texte);
  return Number.isInteger(valeur) ? valeur : Number.NaN;
}

/** Date ISO du serveur → valeur d'un champ datetime-local (heure locale). */
export function versDateHeureLocale(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

/** Valeur d'un champ datetime-local → date ISO (UTC), ou null si vide. */
export function depuisDateHeureLocale(valeur) {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Identifiants d'une liste qui peut contenir des ids ou des objets { id }. */
export const identifiants = (liste) => (liste || []).map((e) => (e && typeof e === 'object' ? e.id : e));
