// Petites mises en forme de la messagerie (suivent la langue de l'interface).
import { localeIntl, t } from '@/i18n/index.js';

/** « 14:30 » */
export function heure(valeur) {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(localeIntl(), { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Clé du jour local (2026-10-20), pour grouper les messages par jour. */
export function jour(valeur) {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « 120 Ko », « 3,4 Mo » */
export function tailleFichier(octets) {
  const n = Number(octets) || 0;
  if (n >= 1024 * 1024) {
    return t('messagerie.taille.mo', { n: new Intl.NumberFormat(localeIntl(), { maximumFractionDigits: 1 }).format(n / 1024 / 1024) });
  }
  return t('messagerie.taille.ko', { n: Math.max(1, Math.round(n / 1024)) });
}
