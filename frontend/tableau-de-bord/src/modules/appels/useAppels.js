// État de la page Appels : historique filtrable (critères dans l'adresse) et jauge d'utilisation JaaS.
import { useEffect } from 'react';

import useChargement from '@/composants/useChargement.js';
import { useCriteres, useRecherche } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';
import { useDirect } from '@/layout/direct.js';

import { listerAppels, usageAppels } from './api.js';

export const ETATS = ['sonne', 'en_cours', 'termine', 'manque', 'refuse', 'annule'];

export default function useAppels() {
  const { valeurs, page, modifier } = useCriteres(['etat', 'q']);
  const direct = useDirect();
  const liste = useListe(listerAppels, { etat: valeurs.etat, recherche: valeurs.q, page });
  const usage = useChargement((signal) => usageAppels({ signal }), []);
  const [saisie, changerSaisie, effacerSaisie] = useRecherche(valeurs.q, (q) => modifier({ q }));
  const { recharger } = liste;
  const { rafraichir } = direct;

  // Ouvrir la liste vaut « vu » pour les appels manqués (côté serveur) : la pastille du menu se recale.
  useEffect(() => { if (!liste.chargement) rafraichir(); }, [liste.chargement, rafraichir]);

  // Un appel change d'état en direct : l'historique et la jauge se relisent.
  useEffect(() => direct.abonner((trame) => {
    if (trame.type === 'appel_entrant' || trame.type === 'appel_mis_a_jour') { recharger(); usage.recharger(); }
  }), [direct, recharger, usage.recharger]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...liste,
    page,
    etat: valeurs.etat,
    usage,
    saisie,
    changerSaisie,
    choisirEtat: (etat) => modifier({ etat }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => { effacerSaisie(); modifier({ q: '', etat: '' }); },
    filtre: Boolean(valeurs.q || valeurs.etat),
  };
}
