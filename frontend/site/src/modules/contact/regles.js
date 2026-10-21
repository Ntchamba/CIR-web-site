// Contrôles du formulaire de contact avant envoi (le serveur revérifie tout).
import { t } from '@/i18n/index.js';

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 1000;
export const TYPES_CONTACT = ['question', 'rappel'];
export const CRENEAUX = ['peu_importe', 'matin', 'apres_midi', 'soir'];

/** `connecte` : un client connecté peut omettre nom, e-mail et téléphone (repris de son compte). */
export function validerContact(form, connecte, telephoneDuCompte = false) {
  const erreurs = {};
  const nom = form.nom.trim();
  const email = form.email.trim();
  const telephone = form.telephone.trim();
  const message = form.message.trim();
  if (!connecte && !nom) erreurs.nom = t('contact.erreurs.nom');
  if (!connecte && !email && !telephone) erreurs.email = t('contact.erreurs.coordonnees');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.email = t('contact.erreurs.email');
  if (form.type === 'rappel' && !telephone && !(connecte && telephoneDuCompte)) erreurs.telephone = t('contact.erreurs.telephoneRappel');
  if (message.length < MESSAGE_MIN) erreurs.message = t('contact.erreurs.messageCourt', { min: MESSAGE_MIN });
  else if (message.length > MESSAGE_MAX) erreurs.message = t('contact.erreurs.messageLong', { max: MESSAGE_MAX });
  return erreurs;
}

/** Corps envoyé : seuls les champs remplis, le champ piège toujours (vide pour un humain). `prefixe` : ligne ajoutée avant le message (projet choisi). */
export function corpsContact(form, produit, prefixe = '') {
  const message = prefixe ? `${prefixe}\n${form.message.trim()}` : form.message.trim();
  const corps = { type: form.type, message, site_web: form.site_web };
  ['nom', 'email', 'telephone'].forEach((c) => {
    if (form[c].trim()) corps[c] = form[c].trim();
  });
  if (form.type === 'rappel') corps.creneau = form.creneau;
  if (produit) corps.produit = produit;
  return corps;
}
