// Règles de la messagerie côté client (le serveur les vérifie aussi, sur la signature des fichiers).
export const TEXTE_MAX = 2000;
export const FICHIERS_MAX = 3;
export const TAILLE_MAX = 10 * 1024 * 1024;

const TYPES = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image', 'application/pdf': 'document',
};
const EXTENSIONS = { jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image', pdf: 'document' };

/** 'image' | 'document' | null (type refusé). */
export function typeDeFichier(fichier) {
  if (fichier.type && Object.hasOwn(TYPES, fichier.type)) return TYPES[fichier.type];
  if (fichier.type) return null;
  const extension = String(fichier.name || '').split('.').pop().toLowerCase();
  return Object.hasOwn(EXTENSIONS, extension) ? EXTENSIONS[extension] : null;
}

/**
 * Contrôle des fichiers choisis avant l'envoi. Renvoie { acceptes, refuses: [{nom, motif}] } ;
 * motif : 'type' | 'taille' | 'vide' | 'nombre'.
 */
export function controlerFichiers(deja, choisis) {
  const acceptes = [];
  const refuses = [];
  Array.from(choisis).forEach((fichier) => {
    if (!typeDeFichier(fichier)) refuses.push({ nom: fichier.name, motif: 'type' });
    else if (fichier.size === 0) refuses.push({ nom: fichier.name, motif: 'vide' });
    else if (fichier.size > TAILLE_MAX) refuses.push({ nom: fichier.name, motif: 'taille' });
    else if (deja + acceptes.length >= FICHIERS_MAX) refuses.push({ nom: fichier.name, motif: 'nombre' });
    else acceptes.push(fichier);
  });
  return { acceptes, refuses };
}

/** Identifiant choisi par le navigateur : évite un doublon si l'envoi est rejoué (≤ 64 caractères). */
export function nouvelleCle() {
  const aleatoire = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `w-${aleatoire}`.slice(0, 64);
}

/** Jour local « 2026-10-20 » d'une date ISO (regroupement du fil par jour). */
export function jourDe(valeur) {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Trie : messages du serveur par identifiant, puis les envois en cours dans leur ordre. */
export function trier(liste) {
  const serveur = liste.filter((m) => m.id !== null && m.id !== undefined).sort((a, b) => a.id - b.id);
  const locaux = liste.filter((m) => m.id === null || m.id === undefined);
  return [...serveur, ...locaux];
}

/** Ajoute ou remplace un message (même identifiant, ou même `cle_client` qu'un envoi en cours). */
export function fusionner(liste, message) {
  const sans = liste.filter((m) => {
    if (message.id !== null && message.id !== undefined && m.id === message.id) return false;
    if (message.cle_client && (m.id === null || m.id === undefined) && m.cle_client === message.cle_client) return false;
    return true;
  });
  return trier([...sans, message]);
}
