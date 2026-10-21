// Flèche de retour (téléphone) : pages racines (sans flèche) et page parente logique de chaque sous-page, utilisée
// quand il n'y a pas de page précédente DU SITE (adresse directe, lien externe). Jamais une sortie du site.

/** Les cinq pages racines des onglets : pas de flèche de retour. */
export const RACINES = ['/', '/catalogue', '/realisations', '/commandes', '/compte'];

// Motif de la sous-page -> parent (`:id` et `:slug` peuvent être repris dans le parent).
const PARENTS = [
  ['/catalogue/:slug', '/catalogue'],
  ['/selection', '/catalogue'],
  ['/actualites', '/'],
  ['/actualites/:slug', '/actualites'],
  ['/commandes/nouvelle', '/commandes'],
  ['/commandes/:id/payer', '/commandes/:id'],
  ['/commandes/:id', '/commandes'],
  ['/paiements/:id/recu', '/commandes'], // le reçu ne porte pas le numéro de la commande
  ['/devis/demande', '/commandes'],
  ['/mes-demandes', '/contact'],
  ['/inscription', '/connexion'],
  ['/contact', '/'],
  ['/messages', '/'],
  ['/notifications', '/'],
  ['/connexion', '/'],
];

const segments = (c) => c.split('/').filter(Boolean);

/** Vrai pour une page racine (l'adresse sans barre finale est comparée). */
export const estRacine = (chemin) => RACINES.includes(chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin);

/** Page parente logique d'une sous-page ('/' par défaut). */
export function parentDe(chemin) {
  const b = segments(chemin);
  for (const [motif, parent] of PARENTS) {
    const a = segments(motif);
    if (a.length !== b.length) continue;
    const valeurs = {};
    if (!a.every((seg, i) => (seg.startsWith(':') ? (valeurs[seg] = b[i], true) : seg === b[i]))) continue;
    return parent.replace(/:\w+/g, (m) => valeurs[m] ?? '');
  }
  return '/';
}
