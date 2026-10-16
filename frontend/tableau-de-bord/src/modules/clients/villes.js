// Suggestions pour le filtre par ville (le serveur filtre sur la ville exacte saisie par le client).
// Noms propres des villes : non traduits (c'est ce que les clients saisissent).
import { localeIntl } from '@/i18n/index.js';

export const VILLES_COURANTES = [
  'Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Buea', 'Limbé', 'Kribi', 'Édéa', 'Garoua', 'Maroua',
  'Ngaoundéré', 'Bertoua', 'Ebolowa', 'Nkongsamba', 'Dschang',
];

/** Villes courantes + villes vues dans les résultats, sans doublon, triées. */
export function suggestionsVilles(clients = []) {
  const toutes = new Set(VILLES_COURANTES);
  clients.forEach((c) => c?.ville && toutes.add(c.ville));
  return [...toutes].sort((a, b) => a.localeCompare(b, localeIntl()));
}
