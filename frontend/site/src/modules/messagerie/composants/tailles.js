// Taille d'un fichier lisible (« 120 Ko »), dans la langue de l'interface.
import { localeIntl, t } from '@partage/i18n/i18n.js';

export function tailleLisible(octets) {
  const n = Number(octets);
  if (!Number.isFinite(n) || n < 0) return '';
  const nombre = (valeur) => new Intl.NumberFormat(localeIntl(), { maximumFractionDigits: 1 }).format(valeur);
  if (n < 1024) return `${nombre(n)} ${t('messagerie.tailles.o')}`;
  if (n < 1024 * 1024) return `${nombre(n / 1024)} ${t('messagerie.tailles.ko')}`;
  return `${nombre(n / (1024 * 1024))} ${t('messagerie.tailles.mo')}`;
}
