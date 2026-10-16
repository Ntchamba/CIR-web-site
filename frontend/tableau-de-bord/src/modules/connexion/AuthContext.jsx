// Session de l'équipe : personne connectée, connexion, déconnexion. Les comptes clients sont refusés
// par le serveur à la connexion, et écartés ici si une ancienne session client traîne dans le navigateur.
// La langue choisie dans l'interface est gardée dans le compte du membre.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ErreurApi } from '@/app/api.js';
import { t } from '@/i18n/index.js';

import * as comptes from './api.js';
import { estEquipe, estSuperAdmin } from './roles.js';

export const AuthContext = createContext(null);

/** Message affiché à un compte client qui tente d'ouvrir le tableau de bord (langue courante). */
export const messageAccesRefuse = () => t('connexion.accesRefuse');

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
      throw new ErreurApi(403, { detail: messageAccesRefuse() });
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

  /** Langue choisie dans l'interface, enregistrée dans le compte (sans effet hors connexion, échec ignoré). */
  const retenirLangue = useCallback(async (langue) => {
    if (!utilisateur || utilisateur.langue === langue) return;
    try {
      setUtilisateur(await comptes.modifierMoi({ langue }));
    } catch {
      /* la langue de l'interface change quand même */
    }
  }, [utilisateur]);

  const valeur = useMemo(
    () => ({
      utilisateur,
      pret,
      connecte: Boolean(utilisateur),
      superAdmin: estSuperAdmin(utilisateur),
      seConnecter,
      seDeconnecter,
      retenirLangue,
    }),
    [utilisateur, pret, seConnecter, seDeconnecter, retenirLangue],
  );
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

/** Session de l'équipe. À utiliser sous <AuthProvider>. */
export function useAuth() {
  const valeur = useContext(AuthContext);
  if (!valeur) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return valeur;
}
