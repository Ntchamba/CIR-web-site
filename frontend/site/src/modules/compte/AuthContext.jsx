// Session du client : utilisateur connecté, connexion, inscription, déconnexion, mise à jour du profil.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/app/api.js';

import * as comptes from './api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let actif = true;
    if (api.jetons.lire()) {
      comptes
        .moi()
        .then((u) => actif && setUtilisateur(u))
        .catch((e) => {
          // Jetons refusés : on oublie la session. Une coupure réseau, elle, ne déconnecte pas.
          if (e?.statut === 401 || e?.statut === 403) api.jetons.effacer();
        })
        .finally(() => actif && setPret(true));
    } else {
      setPret(true);
    }
    // Si les jetons disparaissent (session expirée, déconnexion dans un autre onglet), on se déconnecte.
    const desabonner = api.jetons.abonner((jetons) => {
      if (!jetons) setUtilisateur(null);
    });
    return () => {
      actif = false;
      desabonner();
    };
  }, []);

  const seConnecter = useCallback(async (email, motDePasse) => {
    const reponse = await comptes.connexion(email, motDePasse);
    if (reponse?.utilisateur) {
      setUtilisateur(reponse.utilisateur);
      return reponse.utilisateur;
    }
    try {
      const u = await comptes.moi();
      setUtilisateur(u);
      return u;
    } catch (e) {
      api.jetons.effacer();
      throw e;
    }
  }, []);

  /** Inscription : le serveur renvoie le profil et les jetons, le client est connecté aussitôt. */
  const sInscrire = useCallback(async (donnees) => {
    const reponse = await comptes.inscription(donnees);
    api.retenirJetons(reponse);
    if (reponse?.utilisateur && reponse?.acces) {
      setUtilisateur(reponse.utilisateur);
      return reponse.utilisateur;
    }
    return seConnecter(donnees.email, donnees.mot_de_passe);
  }, [seConnecter]);

  const seDeconnecter = useCallback(async () => {
    setUtilisateur(null);
    await comptes.deconnexion();
  }, []);

  const mettreAJour = useCallback(async (donnees) => {
    const u = await comptes.modifierMoi(donnees);
    setUtilisateur(u);
    return u;
  }, []);

  const valeur = useMemo(
    () => ({ utilisateur, pret, connecte: Boolean(utilisateur), seConnecter, sInscrire, seDeconnecter, mettreAJour }),
    [utilisateur, pret, seConnecter, sInscrire, seDeconnecter, mettreAJour],
  );
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

/** Session du client. À utiliser sous <AuthProvider>. */
export function useAuth() {
  const valeur = useContext(AuthContext);
  if (!valeur) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return valeur;
}
