// Session de l'équipe : personne connectée, connexion, déconnexion. Les comptes clients sont refusés
// par le serveur à la connexion, et écartés ici si une ancienne session client traîne dans le navigateur.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ErreurApi } from '@/app/api.js';

import * as comptes from './api.js';
import { estEquipe, estSuperAdmin } from './roles.js';

export const AuthContext = createContext(null);

export const MESSAGE_ACCES_REFUSE = "Ce compte n'a pas accès au tableau de bord.";

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let actif = true;
    if (api.jetons.lire()) {
      comptes
        .moi()
        .then((u) => {
          if (!actif) return;
          if (estEquipe(u)) setUtilisateur(u);
          else api.jetons.effacer();
        })
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
    let u = reponse?.utilisateur;
    if (!u) {
      try {
        u = await comptes.moi();
      } catch (e) {
        api.jetons.effacer();
        throw e;
      }
    }
    if (!estEquipe(u)) {
      // Double sécurité : le serveur refuse déjà les clients sur cette route.
      api.jetons.effacer();
      throw new ErreurApi(403, { detail: MESSAGE_ACCES_REFUSE });
    }
    setUtilisateur(u);
    return u;
  }, []);

  const seDeconnecter = useCallback(async () => {
    setUtilisateur(null);
    try {
      await comptes.deconnexion();
    } catch {
      api.jetons.effacer(); // le serveur injoignable n'empêche pas de quitter la session
    }
  }, []);

  const valeur = useMemo(
    () => ({
      utilisateur,
      pret,
      connecte: Boolean(utilisateur),
      superAdmin: estSuperAdmin(utilisateur),
      seConnecter,
      seDeconnecter,
    }),
    [utilisateur, pret, seConnecter, seDeconnecter],
  );
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

/** Session de l'équipe. À utiliser sous <AuthProvider>. */
export function useAuth() {
  const valeur = useContext(AuthContext);
  if (!valeur) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return valeur;
}
