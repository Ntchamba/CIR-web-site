/** Mise en forme commune : montants en FCFA, surfaces, dates, dans la langue de l'interface. */
import { localeIntl, t } from '../i18n/i18n.js';

const nombre = (valeur, chiffres = 0) =>
  new Intl.NumberFormat(localeIntl(), { maximumFractionDigits: chiffres }).format(valeur);

const estVide = (valeur) => valeur === null || valeur === undefined || valeur === '' || Number.isNaN(Number(valeur));

/** Libellés des unités de prix (dans la langue courante) : UNITES.m2 → « FCFA / m² ». */
export const UNITES = {
  get m2() { return t('format.unites.m2'); },
  get kg() { return t('format.unites.kg'); },
  get pose() { return t('format.unites.pose'); },
};

/** « 12 500 FCFA » ; « — » si la valeur est absente. */
export function fcfa(valeur) {
  if (estVide(valeur)) return '—';
  return `${nombre(Number(valeur))} ${t('format.devise')}`;
}

/** Prix d'un produit : « 12 500 FCFA / m² », ou « Prix sur devis » s'il n'est pas fixé (jamais de prix inventé). */
export function prix(valeur, unite) {
  if (estVide(valeur)) return t('format.prixSurDevis');
  const libelle = unite && Object.hasOwn(UNITES, unite) ? UNITES[unite] : t('format.devise');
  return `${nombre(Number(valeur))} ${libelle}`;
}

/** « 42,5 m² » */
export function surface(valeur) {
  if (estVide(valeur) || Number(valeur) === 0) return '—';
  return `${nombre(Number(valeur), 2)} m²`;
}

function enDate(valeur) {
  if (!valeur) return null;
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 16 octobre 2026 » (options Intl.DateTimeFormat facultatives). */
export function date(valeur, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = enDate(valeur);
  return d ? new Intl.DateTimeFormat(localeIntl(), options).format(d) : '';
}

/** « 16 octobre 2026 à 14:30 » */
export function dateHeure(valeur) {
  const d = enDate(valeur);
  if (!d) return '';
  const heure = new Intl.DateTimeFormat(localeIntl(), { hour: '2-digit', minute: '2-digit' }).format(d);
  return t('format.dateHeure', { date: date(d), heure });
}

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 j », puis « 12 mars ». */
export function depuis(valeur, maintenant = Date.now()) {
  const d = enDate(valeur);
  if (!d) return '';
  const secondes = (maintenant - d.getTime()) / 1000;
  if (secondes < 60) return t('format.depuis.instant');
  if (secondes < 3600) return t('format.depuis.minutes', { n: Math.floor(secondes / 60) });
  if (secondes < 86400) return t('format.depuis.heures', { n: Math.floor(secondes / 3600) });
  if (secondes < 172800) return t('format.depuis.hier');
  if (secondes < 604800) return t('format.depuis.jours', { n: Math.floor(secondes / 86400) });
  return date(d, { day: 'numeric', month: 'short' });
}

/** Étapes d'une commande (règle métier), avec la classe CSS des jetons --st-*. `libelle` suit la langue. */
const etape = (cle, classe) => ({ get libelle() { return t(`statuts.${cle}`); }, classe });
export const STATUTS = {
  nouvelle: etape('nouvelle', 'nouvelle'),
  negociation: etape('negociation', 'negociation'),
  contrat_signe: etape('contrat_signe', 'contrat'),
  travaux: etape('travaux', 'travaux'),
  terminee: etape('terminee', 'terminee'),
  annulee: etape('annulee', 'annulee'),
};
