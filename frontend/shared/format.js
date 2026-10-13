/** Mise en forme commune : prix en FCFA, surfaces, dates. */

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const surfaceFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const UNITES = { m2: 'FCFA / m²', kg: 'FCFA / kg', pose: 'FCFA / m², pose comprise' };

export function prix(valeur, unite) {
  if (valeur === null || valeur === undefined || valeur === '') return 'Prix sur devis';
  return `${nombre.format(Number(valeur))} ${unite ? UNITES[unite] || 'FCFA' : 'FCFA'}`;
}

export function montant(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  return `${nombre.format(Number(valeur))} FCFA`;
}

export function surface(valeur) {
  if (!valeur) return '—';
  return `${surfaceFmt.format(Number(valeur))} m²`;
}

export function date(valeur, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!valeur) return '';
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(valeur));
}

export function heure(valeur) {
  return date(valeur, { hour: '2-digit', minute: '2-digit' });
}

/** « il y a 5 min », « hier », « 12 mars » */
export function depuis(valeur) {
  if (!valeur) return '';
  const secondes = (Date.now() - new Date(valeur).getTime()) / 1000;
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  if (secondes < 172800) return 'hier';
  if (secondes < 604800) return `il y a ${Math.floor(secondes / 86400)} j`;
  return date(valeur, { day: 'numeric', month: 'short' });
}

export const TYPES_BATIMENT = { maison: 'Maison', industrie: 'Industrie', entreprise: 'Entreprise', exterieur: 'Extérieur' };

export const STATUTS = {
  nouvelle: { libelle: 'Nouvelle', classe: 'nouvelle' },
  negociation: { libelle: 'En négociation', classe: 'negociation' },
  contrat_signe: { libelle: 'Contrat signé', classe: 'contrat' },
  travaux: { libelle: 'Travaux en cours', classe: 'travaux' },
  terminee: { libelle: 'Terminée', classe: 'terminee' },
  annulee: { libelle: 'Annulée', classe: 'annulee' },
};
