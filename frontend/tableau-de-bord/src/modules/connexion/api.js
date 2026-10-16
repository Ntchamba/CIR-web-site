// BF-17 : connexion de l'équipe au tableau de bord. Champs en français (mot_de_passe, acces, rafraichissement).
import { api, CHEMINS } from '@/app/api.js';

/**
 * { email, mot_de_passe } → { acces, rafraichissement, utilisateur } ; les jetons sont rangés.
 * Le serveur répond 403 « Ce compte n'a pas accès au tableau de bord. » pour un compte client.
 */
export const connexion = (email, motDePasse) =>
  api.connecter({ email, mot_de_passe: motDePasse }, { chemin: CHEMINS.connexionEquipe });

/** Profil de la personne connectée (sert à restaurer la session au rechargement). */
export const moi = () => api.get('/api/comptes/moi/');

/** Modifie le profil de la personne connectée (ici : sa langue préférée). → profil mis à jour. */
export const modifierMoi = (donnees) => api.patch('/api/comptes/moi/', donnees);

/** Liste noire du jeton de rafraîchissement, puis effacement des jetons locaux. */
export const deconnexion = () => api.deconnecter();
