// BF-08 : appels à l'API des comptes.
import { api } from '@/lib/api.js';

export const connexion = (email, password) => api.post('/comptes/connexion/', { email, password }, { auth: false });
export const inscription = (donnees) => api.post('/comptes/inscription/', donnees, { auth: false });
export const moi = () => api.get('/comptes/moi/');
export const modifierMoi = (donnees) => api.patch('/comptes/moi/', donnees);
export const deconnexion = (refresh) => api.post('/comptes/deconnexion/', { refresh }, { auth: false }).catch(() => null);
