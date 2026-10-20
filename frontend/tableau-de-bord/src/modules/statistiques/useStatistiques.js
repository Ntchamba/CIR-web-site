// État de la page Statistiques : période (dans l'adresse : ?p=30j, ou ?p=libre&du=…&au=…), indicateurs de la période
// et évolution mensuelle. Une période invalide n'est jamais envoyée au serveur.
import { useMemo, useState } from 'react';

import useChargement from '@/composants/useChargement.js';
import { useCriteres } from '@/composants/useCriteres.js';

import { evolutionStatistiques, resumeStatistiques } from './api.js';
import { calculerPeriode, erreurPeriode, PERIODE_DEFAUT, PERIODES } from './periode.js';

export default function useStatistiques() {
  const { valeurs, modifier } = useCriteres(['p', 'du', 'au']);
  const [maintenant] = useState(() => new Date());
  const choix = PERIODES.includes(valeurs.p) ? valeurs.p : PERIODE_DEFAUT;
  const periode = useMemo(
    () => calculerPeriode(choix, { du: valeurs.du, au: valeurs.au }, maintenant),
    [choix, valeurs.du, valeurs.au, maintenant],
  );
  const erreurDates = erreurPeriode(periode);

  const resume = useChargement(
    (signal) => (erreurDates ? Promise.resolve(null) : resumeStatistiques(periode, { signal })),
    [periode.du, periode.au, Boolean(erreurDates)],
  );
  const evolution = useChargement((signal) => evolutionStatistiques(12, { signal }), []);

  return {
    choix,
    periode,
    erreurDates,
    resume: erreurDates ? null : resume.donnees,
    chargement: !erreurDates && resume.chargement,
    erreur: erreurDates ? null : resume.erreur,
    recharger: () => { resume.recharger(); evolution.recharger(); },
    evolution: evolution.donnees?.mois || null,
    chargementEvolution: evolution.chargement,
    erreurEvolution: evolution.erreur,
    choisir: (p) => modifier(p === 'libre'
      ? { p, du: valeurs.du || periode.du, au: valeurs.au || periode.au }
      : { p: p === PERIODE_DEFAUT ? '' : p, du: '', au: '' }),
    appliquerDates: (du, au) => modifier({ p: 'libre', du, au }),
  };
}
