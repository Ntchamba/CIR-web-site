// Session de l'équipe : connexion au tableau de bord (comptes « équipe » uniquement).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (api.jetons.lire()) {
      api.get('/comptes/moi/')
        .then((u) => (u.is_staff ? setUtilisateur(u) : api.jetons.ecrire(null)))
        .catch(() => api.jetons.ecrire(null))
        .finally(() => setPret(true));
    } else {
      setPret(true);
    }
    return api.jetons.abonner((j) => { if (!j) setUtilisateur(null); });
  }, []);

  const seConnecter = useCallback(async (email, password) => {
    const r = await api.post('/admin/comptes/connexion/', { email, password }, { auth: false });
    api.jetons.ecrire({ access: r.access, refresh: r.refresh });
    setUtilisateur(r.utilisateur);
  }, []);

  const seDeconnecter = useCallback(async () => {
    const j = api.jetons.lire();
    if (j?.refresh) await api.post('/comptes/deconnexion/', { refresh: j.refresh }, { auth: false }).catch(() => null);
    api.jetons.ecrire(null);
  }, []);

  const valeur = useMemo(() => ({ utilisateur, pret, seConnecter, seDeconnecter }),
    [utilisateur, pret, seConnecter, seDeconnecter]);
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
