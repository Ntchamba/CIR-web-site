// Usages d'un produit et types de chantier (contrat d'API de la vague 1), libellés traduits.
import { t } from '@/i18n/index.js';

export const CODES_USAGES = ['maison', 'industrie', 'entreprise', 'exterieur'];

/** Libellé d'un usage ou d'un type de chantier (le code s'affiche tel quel s'il est inconnu). */
export function libelleUsage(code) {
  if (!code) return '';
  return CODES_USAGES.includes(code) ? t(`usages.${code}`) : code;
}

/** Options d'une liste déroulante : [[code, libellé]], avec un premier choix vide facultatif. */
export function optionsUsages(premier) {
  const options = CODES_USAGES.map((code) => [code, libelleUsage(code)]);
  return premier ? [['', premier], ...options] : options;
}
