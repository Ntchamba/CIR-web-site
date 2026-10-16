// BF-08 : appels à l'API des comptes. Champs en français (mot_de_passe, acces, rafraichissement).
import { api } from '@/app/api.js';

/** { email, mot_de_passe } → { acces, rafraichissement, utilisateur } ; les jetons sont rangés. */
export const connexion = (email, motDePasse) => api.connecter({ email, mot_de_passe: motDePasse });

/** { email, mot_de_passe, nom_complet, telephone, ville, quartier, rue_ou_repere } → { utilisateur, acces, rafraichissement } */
export const inscription = (donnees) => api.post('/api/comptes/inscription/', donnees, { auth: false });

export const moi = () => api.get('/api/comptes/moi/');

/** Modifiables : nom_complet, telephone, ville, quartier, rue_ou_repere (ni l'e-mail ni le rôle). */
export const modifierMoi = (donnees) => api.patch('/api/comptes/moi/', donnees);

/** Liste noire du jeton de rafraîchissement, puis effacement des jetons locaux. */
export const deconnexion = () => api.deconnecter();
