// Contrôles de saisie du formulaire de connexion (le serveur reste seul juge).
import { t } from '@/i18n/index.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contrôle de saisie avant l'envoi : { champ: message }. */
export function validerConnexion({ email, mot_de_passe: motDePasse }) {
  const erreurs = {};
  if (!email.trim()) erreurs.email = t('validation.emailVide');
  else if (!EMAIL.test(email.trim())) erreurs.email = t('validation.emailInvalide');
  if (!motDePasse) erreurs.mot_de_passe = t('validation.motDePasseVide');
  return erreurs;
}
