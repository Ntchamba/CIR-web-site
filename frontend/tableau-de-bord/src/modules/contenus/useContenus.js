// État des contenus du site : accueil, bandeaux, photos de la sphère.
import useChargement from '@/composants/useChargement.js';

import * as contenusApi from './api.js';

const parOrdre = (a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (a.id ?? 0) - (b.id ?? 0);

/** Petite liste modifiable sur place (bandeaux, sphère), triée par ordre. */
function useListe(charger) {
  const etat = useChargement((signal) => charger({ signal }), [], { initial: [] });
  const elements = [...(etat.donnees || [])].sort(parOrdre);
  const remplacer = (element) => etat.setDonnees((liste) => {
    const l = liste || [];
    return l.some((e) => e.id === element.id) ? l.map((e) => (e.id === element.id ? element : e)) : [...l, element];
  });
  const retirer = (id) => etat.setDonnees((liste) => (liste || []).filter((e) => e.id !== id));
  return { ...etat, elements, remplacer, retirer };
}

export const useBandeaux = () => useListe(contenusApi.listerBandeaux);
export const useSphere = () => useListe(contenusApi.listerSphere);

/** Contenu de l'accueil (enregistrement unique). */
export default function useContenus() {
  return useChargement((signal) => contenusApi.obtenirAccueil({ signal }), []);
}

/**
 * Date « YYYY-MM-DD » (DateField du serveur) → Date à minuit, heure locale. `new Date('2026-10-31')` serait minuit
 * UTC, soit la veille dans les fuseaux à l'ouest de Greenwich : on construit la date à partir de ses chiffres.
 */
export function dateDuJour(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * État d'un bandeau : 'inactif', 'programme' (début futur), 'expire' (fin passée) ou 'actif'.
 * Règle du serveur : affiché si debut <= aujourd'hui <= fin (le jour de fin est inclus).
 */
export function etatBandeau(bandeau, maintenant = new Date()) {
  if (!bandeau?.actif) return 'inactif';
  const jour = (v) => String(v || '').slice(0, 10);
  const aujourdhui = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`;
  if (bandeau.debut && jour(bandeau.debut) > aujourdhui) return 'programme';
  if (bandeau.fin && jour(bandeau.fin) < aujourdhui) return 'expire';
  return 'actif';
}
