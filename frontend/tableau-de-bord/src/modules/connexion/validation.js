// Contrôles de saisie du formulaire de connexion (le serveur reste seul juge).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contrôle de saisie avant l'envoi : { champ: message }. */
export function validerConnexion({ email, mot_de_passe: motDePasse }) {
  const erreurs = {};
  if (!email.trim()) erreurs.email = 'Indiquez votre e-mail.';
  else if (!EMAIL.test(email.trim())) erreurs.email = "Cet e-mail n'est pas valide.";
  if (!motDePasse) erreurs.mot_de_passe = 'Indiquez votre mot de passe.';
  return erreurs;
}
