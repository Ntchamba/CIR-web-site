// Petites règles de saisie des formulaires de commande : le serveur revérifie tout.
import { t } from '@/i18n/index.js';

export const TYPES_BATIMENT = ['maison', 'industrie', 'entreprise'];
export const DESCRIPTION_MAX = 1500;
export const MESSAGE_MAX = 1000;

/** « 42,5 » ou « 42.5 » → nombre ; vide → null ; invalide → NaN. */
export function nombreOuVide(texte) {
  const brut = String(texte ?? '').trim().replace(',', '.');
  if (brut === '') return null;
  return /^\d+(\.\d+)?$/.test(brut) ? Number(brut) : Number.NaN;
}

/** Erreurs du formulaire de commande : { champ: message }. */
export function validerCommande({ type_batiment: type, surface_m2: surface, description }) {
  const erreurs = {};
  if (!TYPES_BATIMENT.includes(type)) erreurs.type_batiment = t('commandes.nouvelle.erreurs.type');
  const s = nombreOuVide(surface);
  if (Number.isNaN(s) || s === 0) erreurs.surface_m2 = t('commandes.nouvelle.erreurs.surface');
  if (String(description ?? '').length > DESCRIPTION_MAX) {
    erreurs.description = t('commandes.nouvelle.erreurs.descriptionLongue', { max: DESCRIPTION_MAX });
  }
  return erreurs;
}

/** Erreurs d'une proposition : un prix au m² ou un total est nécessaire. */
export function validerProposition({ prix_m2: prixM2, total, delai_jours: delai, message }) {
  const erreurs = {};
  const p = nombreOuVide(prixM2);
  const tot = nombreOuVide(total);
  if (Number.isNaN(p) || (p !== null && !Number.isInteger(p))) erreurs.prix_m2 = t('commandes.proposition.erreurs.entier');
  if (Number.isNaN(tot) || (tot !== null && !Number.isInteger(tot))) erreurs.total = t('commandes.proposition.erreurs.entier');
  if (!erreurs.prix_m2 && !erreurs.total && p === null && tot === null) {
    erreurs.prix_m2 = t('commandes.proposition.erreurs.montant');
  }
  const d = nombreOuVide(delai);
  if (d !== null && (Number.isNaN(d) || !Number.isInteger(d) || d < 1)) erreurs.delai_jours = t('commandes.proposition.erreurs.delai');
  if (String(message ?? '').length > MESSAGE_MAX) erreurs.message = t('commandes.proposition.erreurs.messageLong', { max: MESSAGE_MAX });
  return erreurs;
}

/** Corps envoyé pour une proposition : seuls les champs remplis. */
export function corpsProposition({ prix_m2: prixM2, total, delai_jours: delai, message }) {
  const corps = {};
  const p = nombreOuVide(prixM2);
  const tot = nombreOuVide(total);
  const d = nombreOuVide(delai);
  if (p !== null) corps.prix_m2 = p;
  if (tot !== null) corps.total = tot;
  if (d !== null) corps.delai_jours = d;
  if (String(message ?? '').trim()) corps.message = String(message).trim();
  return corps;
}

/** Le serveur dit que l'adresse du compte est incomplète : on renvoie vers le compte. */
export const adresseIncomplete = (erreur) => erreur?.statut === 403 && erreur?.donnees?.code === 'adresse_incomplete';
