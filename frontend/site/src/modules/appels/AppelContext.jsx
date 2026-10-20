// Appel en cours du client : lancement (API), état suivi par la salle d'appel plein écran.
// Le fournisseur est global (App.jsx) ; la salle est affichée par le gabarit.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import * as appels from './api.js';

const VALEUR_VIDE = { appel: null, jitsi: null, type: null, lancer: async () => {}, mettreAJour: () => {}, fermer: () => {} };
const AppelContext = createContext(VALEUR_VIDE);

export const ETATS_ACTIFS = ['sonne', 'en_cours'];

export function AppelProvider({ children }) {
  const [courant, setCourant] = useState(null); // { appel, jitsi, type }

  /** Lance un appel ; les erreurs du serveur (ErreurApi) sont relancées pour être expliquées par l'appelant. */
  const lancer = useCallback(async ({ type, commande }) => {
    const reponse = await appels.lancer({ type, ...(commande ? { commande } : {}) });
    setCourant({ appel: reponse.appel, jitsi: reponse.jitsi, type });
    return reponse.appel;
  }, []);

  const mettreAJour = useCallback((appel) => {
    setCourant((c) => (c && appel && c.appel.id === appel.id ? { ...c, appel } : c));
  }, []);

  const fermer = useCallback(() => setCourant(null), []);

  const valeur = useMemo(
    () => ({ appel: courant?.appel ?? null, jitsi: courant?.jitsi ?? null, type: courant?.type ?? null, lancer, mettreAJour, fermer }),
    [courant, lancer, mettreAJour, fermer],
  );
  return <AppelContext.Provider value={valeur}>{children}</AppelContext.Provider>;
}

export function useAppel() {
  return useContext(AppelContext);
}
