// Périodes du tableau des statistiques. Les jours sont des textes AAAA-MM-JJ calculés à l'heure de Douala
// (le fuseau du serveur), pas à celle du navigateur. La période demandée au serveur ne dépasse jamais 366 jours.
export const PERIODES = ['7j', '30j', 'mois', '12m', 'libre'];
export const PERIODE_DEFAUT = '30j';
export const JOURS_MAX = 366;

const JOUR = 86_400_000;
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Jour courant à Douala : « 2026-10-20 ». */
export function aujourdhui(maintenant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(maintenant);
}

const enDate = (jour) => new Date(`${jour}T00:00:00Z`);
const enTexte = (date) => date.toISOString().slice(0, 10);
const decaler = (jour, jours) => enTexte(new Date(enDate(jour).getTime() + jours * JOUR));

/** Vrai si le texte est un vrai jour du calendrier (pas de « 2026-02-31 »). */
export const jourValide = (jour) => FORMAT_JOUR.test(jour || '') && enTexte(enDate(jour)) === jour;

/** → { du, au } pour une période prédéfinie ; `libre` reprend les dates données. */
export function calculerPeriode(periode, libre = {}, maintenant = new Date()) {
  const au = aujourdhui(maintenant);
  switch (periode) {
    case '7j': return { du: decaler(au, -6), au };
    case 'mois': return { du: `${au.slice(0, 8)}01`, au };
    case '12m': {
      // Premier jour du mois qui a lieu onze mois avant le mois courant : douze mois civils, dont le mois en cours.
      const indice = Number(au.slice(0, 4)) * 12 + Number(au.slice(5, 7)) - 1 - 11;
      return { du: `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}-01`, au };
    }
    case 'libre': return { du: libre.du || '', au: libre.au || '' };
    default: return { du: decaler(au, -29), au };
  }
}

/** Nombre de jours de la période, bornes comprises. */
export const nombreDeJours = (du, au) => Math.round((enDate(au).getTime() - enDate(du).getTime()) / JOUR) + 1;

/** → null si la période est acceptable, sinon 'incomplete' | 'invalide' | 'ordre' | 'longue'. */
export function erreurPeriode({ du, au }) {
  if (!du || !au) return 'incomplete';
  if (!jourValide(du) || !jourValide(au)) return 'invalide';
  if (du > au) return 'ordre';
  if (nombreDeJours(du, au) > JOURS_MAX) return 'longue';
  return null;
}
