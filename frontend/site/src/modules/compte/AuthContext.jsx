// Session du client : utilisateur connecté, connexion, inscription, déconnexion.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api.js';

import * as comptes from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (api.jetons.lire()) {
      comptes.moi().then(setUtilisateur).catch(() => api.jetons.ecrire(null)).finally(() => setPret(true));
    } else {
      setPret(true);
    }
    // Si les jetons disparaissent (session expirée), on se déconnecte partout.
    return api.jetons.abonner((jetons) => { if (!jetons) setUtilisateur(null); });
  }, []);

  const seConnecter = useCallback(async (email, motDePasse) => {
    const r = await comptes.connexion(email, motDePasse);
    api.jetons.ecrire({ access: r.access, refresh: r.refresh });
    setUtilisateur(r.utilisateur);
    return r.utilisateur;
  }, []);

  const sInscrire = useCallback(async (donnees) => {
    await comptes.inscription(donnees);
    return seConnecter(donnees.email, donnees.password);
  }, [seConnecter]);

  const seDeconnecter = useCallback(async () => {
    const jetons = api.jetons.lire();
    if (jetons?.refresh) await comptes.deconnexion(jetons.refresh);
    api.jetons.ecrire(null);
    setUtilisateur(null);
  }, []);

  const mettreAJour = useCallback(async (donnees) => {
    const u = await comptes.modifierMoi(donnees);
    setUtilisateur(u);
    return u;
  }, []);

  const valeur = useMemo(() => ({ utilisateur, pret, seConnecter, sInscrire, seDeconnecter, mettreAJour }),
    [utilisateur, pret, seConnecter, sInscrire, seDeconnecter, mettreAJour]);
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
