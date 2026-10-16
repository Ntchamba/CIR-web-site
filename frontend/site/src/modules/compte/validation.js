// Vérifications côté navigateur avant l'envoi (le serveur revérifie tout).
import { validerAdresse } from './adresse.js';

const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validerEmail(email, erreurs) {
  if (!email.trim()) erreurs.email = 'Indiquez votre adresse e-mail.';
  else if (!MOTIF_EMAIL.test(email.trim())) erreurs.email = "Cette adresse e-mail n'est pas valide.";
}

function validerTelephone(telephone, erreurs) {
  // Facultatif côté serveur ; s'il est donné, il doit être plausible.
  if (telephone.trim() && telephone.replace(/\D/g, '').length < 8) {
    erreurs.telephone = 'Ce numéro de téléphone semble incomplet.';
  }
}

export function validerConnexion({ email, mot_de_passe: motDePasse }) {
  const erreurs = {};
  validerEmail(email, erreurs);
  if (!motDePasse) erreurs.mot_de_passe = 'Indiquez votre mot de passe.';
  return erreurs;
}

export function validerInscription(form) {
  const erreurs = {};
  if (!form.nom_complet.trim()) erreurs.nom_complet = 'Indiquez votre nom complet.';
  validerEmail(form.email, erreurs);
  validerTelephone(form.telephone, erreurs);
  if (!form.mot_de_passe) erreurs.mot_de_passe = 'Choisissez un mot de passe.';
  else if (form.mot_de_passe.length < 8) erreurs.mot_de_passe = 'Le mot de passe doit contenir au moins 8 caractères.';
  else if (/^\d+$/.test(form.mot_de_passe)) erreurs.mot_de_passe = 'Le mot de passe ne peut pas contenir que des chiffres.';
  return { ...erreurs, ...validerAdresse(form) };
}

export function validerProfil(form) {
  const erreurs = {};
  if (!form.nom_complet.trim()) erreurs.nom_complet = 'Indiquez votre nom complet.';
  validerTelephone(form.telephone, erreurs);
  return { ...erreurs, ...validerAdresse(form) };
}
