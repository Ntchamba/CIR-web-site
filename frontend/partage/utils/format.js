/** Mise en forme commune : montants en FCFA, surfaces, dates en français. */

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

const estVide = (valeur) => valeur === null || valeur === undefined || valeur === '' || Number.isNaN(Number(valeur));

export const UNITES = { m2: 'FCFA / m²', kg: 'FCFA / kg', pose: 'FCFA / m², pose comprise' };

/** « 12 500 FCFA » ; « — » si la valeur est absente. */
export function fcfa(valeur) {
  if (estVide(valeur)) return '—';
  return `${nombre.format(Number(valeur))} FCFA`;
}

/** Prix d'un produit : « 12 500 FCFA / m² », ou « Prix sur devis » s'il n'est pas fixé (jamais de prix inventé). */
export function prix(valeur, unite) {
  if (estVide(valeur)) return 'Prix sur devis';
  return `${nombre.format(Number(valeur))} ${(unite && UNITES[unite]) || 'FCFA'}`;
}

/** « 42,5 m² » */
export function surface(valeur) {
  if (estVide(valeur) || Number(valeur) === 0) return '—';
  return `${decimal.format(Number(valeur))} m²`;
}

function enDate(valeur) {
  if (!valeur) return null;
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 16 octobre 2026 » (options Intl.DateTimeFormat facultatives). */
export function date(valeur, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = enDate(valeur);
  return d ? new Intl.DateTimeFormat('fr-FR', options).format(d) : '';
}

/** « 16 octobre 2026 à 14:30 » */
export function dateHeure(valeur) {
  const d = enDate(valeur);
  if (!d) return '';
  return `${date(d)} à ${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)}`;
}

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 j », puis « 12 mars ». */
export function depuis(valeur, maintenant = Date.now()) {
  const d = enDate(valeur);
  if (!d) return '';
  const secondes = (maintenant - d.getTime()) / 1000;
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  if (secondes < 172800) return 'hier';
  if (secondes < 604800) return `il y a ${Math.floor(secondes / 86400)} j`;
  return date(d, { day: 'numeric', month: 'short' });
}

/** Étapes d'une commande (règle métier), avec la classe CSS des jetons --st-*. */
export const STATUTS = {
  nouvelle: { libelle: 'Nouvelle', classe: 'nouvelle' },
  negociation: { libelle: 'En négociation', classe: 'negociation' },
  contrat_signe: { libelle: 'Contrat signé', classe: 'contrat' },
  travaux: { libelle: 'Travaux en cours', classe: 'travaux' },
  terminee: { libelle: 'Terminée', classe: 'terminee' },
  annulee: { libelle: 'Annulée', classe: 'annulee' },
};
