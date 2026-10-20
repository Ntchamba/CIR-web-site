// Petites règles du module paiements : le serveur revérifie tout (montant, étape, quota).
import { fcfa } from '@partage/utils/format.js';

import { t } from '@/i18n/index.js';

export const ETATS_FINAUX = ['reussi', 'echoue', 'expire', 'annule', 'anomalie'];
/** Étapes où un paiement est possible (le serveur décide, ceci évite d'afficher un bouton inutile). */
export const ETAPES_PAYABLES = ['contrat_signe', 'travaux', 'terminee'];
export const RAISONS = ['numero_invalide', 'refuse', 'expire', 'montant_different', 'inconnue'];
/** Durée d'attente annoncée à titre indicatif (PAIEMENT_EXPIRATION_MINUTES côté serveur, 15 par défaut). */
export const ATTENTE_INDICATIVE_MS = 15 * 60 * 1000;

/** Entier strictement positif, sinon null (valeur absente ou incohérente : on garde le comportement par défaut). */
export function entierPositif(valeur) {
  const n = typeof valeur === 'number' ? valeur : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Durée d'attente indicative en ms : `expiration_minutes` de la disponibilité, sinon 15 minutes. */
export const attenteMs = (expirationMinutes) => {
  const minutes = entierPositif(expirationMinutes);
  return minutes ? minutes * 60 * 1000 : ATTENTE_INDICATIVE_MS;
};
export const DELAI_VERIFICATION_MS = 4000;

const entier = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Reste à payer d'une commande (null si aucun montant convenu). */
export const resteAPayer = (commande) => entier(commande?.reste_a_payer);
export const montantPaye = (commande) => entier(commande?.montant_paye) ?? 0;

/** Le bouton « Payer » n'a de sens que si le contrat est signé et qu'il reste quelque chose à payer. */
export function peutPayer(commande) {
  const reste = resteAPayer(commande);
  return ETAPES_PAYABLES.includes(commande?.etat)
    && ['non_paye', 'partiel'].includes(commande?.statut_paiement)
    && reste !== null && reste > 0;
}

/** « 6 99 00 11 22 », « +237 699001122 »… : 9 chiffres commençant par 6, avec indicatif facultatif. */
export function telephoneValide(texte) {
  const chiffres = String(texte ?? '').replace(/[\s.\-()]/g, '').replace(/^(\+|00)/, '');
  return /^(237)?6\d{8}$/.test(chiffres);
}

/** Erreurs du formulaire : { telephone?, montant? } (messages traduits). */
export function validerPaiement({ mode, telephone, choixMontant, montant }, reste, minimum = null) {
  const erreurs = {};
  if (mode === 'mobile' && !telephoneValide(telephone)) erreurs.telephone = t('paiements.erreurs.telephone');
  if (choixMontant === 'autre') {
    const brut = String(montant ?? '').trim();
    const valeur = /^\d+$/.test(brut) ? Number(brut) : Number.NaN;
    if (!Number.isInteger(valeur) || valeur < 1) erreurs.montant = t('paiements.erreurs.montantEntier');
    else if (reste !== null && valeur > reste) erreurs.montant = t('paiements.erreurs.montantReste');
    else {
      // Minimum du serveur (ou le reste s'il est plus petit) ; absent = aucun minimum côté client.
      const plancher = entierPositif(minimum);
      const seuil = plancher && reste !== null ? Math.min(plancher, reste) : plancher;
      if (seuil && valeur < seuil) erreurs.montant = t('paiements.erreurs.montantMinimum', { minimum: fcfa(seuil) });
    }
  }
  return erreurs;
}

/** Code d'erreur métier du serveur (`{detail, code}`), sinon chaîne vide. */
export const codeErreur = (erreur) => (typeof erreur?.donnees?.code === 'string' ? erreur.donnees.code : '');

/** Message affiché pour une erreur de création de paiement (texte traduit du site, sinon celui du serveur). */
export function messageCreation(erreur) {
  const code = codeErreur(erreur);
  const connus = ['paiement_en_cours', 'paiement_non_autorise', 'trop_de_paiements', 'paiements_non_configures', 'paiements_indisponibles'];
  if (connus.includes(code)) return t(`paiements.erreurs.${code}`);
  return erreur;
}

/** Un paiement final ne revient jamais à « en attente » (réponse tardive d'une vérification précédente). */
export function fusionner(courant, entrant) {
  if (!entrant) return courant;
  if (courant && courant.id === entrant.id && courant.etat !== 'en_attente' && entrant.etat === 'en_attente') return courant;
  return entrant;
}

/** Texte de la raison d'un échec : libellé du serveur (déjà traduit), sinon texte du site. */
export function texteRaison(paiement) {
  if (paiement?.raison_libelle) return paiement.raison_libelle;
  const raison = RAISONS.includes(paiement?.raison) ? paiement.raison : 'inconnue';
  return t(`paiements.raisons.${raison}`);
}
