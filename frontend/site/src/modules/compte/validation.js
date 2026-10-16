// Vérifications côté navigateur avant l'envoi (le serveur revérifie tout).
import { t } from '@/i18n/index.js';

import { validerAdresse } from './adresse.js';

const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validerEmail(email, erreurs) {
  if (!email.trim()) erreurs.email = t('compte.validation.emailVide');
  else if (!MOTIF_EMAIL.test(email.trim())) erreurs.email = t('compte.validation.emailInvalide');
}

function validerTelephone(telephone, erreurs) {
  // Facultatif côté serveur ; s'il est donné, il doit être plausible.
  if (telephone.trim() && telephone.replace(/\D/g, '').length < 8) {
    erreurs.telephone = t('compte.validation.telephoneIncomplet');
  }
}

export function validerConnexion({ email, mot_de_passe: motDePasse }) {
  const erreurs = {};
  validerEmail(email, erreurs);
  if (!motDePasse) erreurs.mot_de_passe = t('compte.validation.motDePasseVide');
  return erreurs;
}

export function validerInscription(form) {
  const erreurs = {};
  if (!form.nom_complet.trim()) erreurs.nom_complet = t('compte.validation.nomVide');
  validerEmail(form.email, erreurs);
  validerTelephone(form.telephone, erreurs);
  if (!form.mot_de_passe) erreurs.mot_de_passe = t('compte.validation.motDePasseAChoisir');
  else if (form.mot_de_passe.length < 8) erreurs.mot_de_passe = t('compte.validation.motDePasseCourt');
  else if (/^\d+$/.test(form.mot_de_passe)) erreurs.mot_de_passe = t('compte.validation.motDePasseChiffres');
  return { ...erreurs, ...validerAdresse(form) };
}

export function validerProfil(form) {
  const erreurs = {};
  if (!form.nom_complet.trim()) erreurs.nom_complet = t('compte.validation.nomVide');
  validerTelephone(form.telephone, erreurs);
  return { ...erreurs, ...validerAdresse(form) };
}
