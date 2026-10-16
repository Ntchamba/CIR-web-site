// Règles de l'adresse du client : ville, quartier et rue ou repère sont obligatoires pour commander.
export const CHAMPS_ADRESSE = ['ville', 'quartier', 'rue_ou_repere'];

export const ADRESSE_VIDE = { ville: '', quartier: '', rue_ou_repere: '' };

/** Extrait les champs d'adresse d'un objet (utilisateur, formulaire). */
export function extraireAdresse(source = {}) {
  return Object.fromEntries(CHAMPS_ADRESSE.map((c) => [c, source?.[c] ?? '']));
}

/**
 * Vrai si l'adresse est complète. Pour un utilisateur renvoyé par l'API, le booléen `adresse_complete`
 * du serveur fait foi ; sinon on vérifie les trois champs.
 */
export function adresseComplete(source) {
  if (typeof source?.adresse_complete === 'boolean') return source.adresse_complete;
  return CHAMPS_ADRESSE.every((c) => String(source?.[c] ?? '').trim() !== '');
}

/** Erreurs de saisie de l'adresse : { champ: message }. */
export function validerAdresse(adresse) {
  const erreurs = {};
  if (!String(adresse?.ville ?? '').trim()) erreurs.ville = 'Indiquez votre ville.';
  if (!String(adresse?.quartier ?? '').trim()) erreurs.quartier = 'Indiquez votre quartier.';
  if (!String(adresse?.rue_ou_repere ?? '').trim()) {
    erreurs.rue_ou_repere = 'Indiquez une rue ou un repère connu.';
  }
  return erreurs;
}

/** Prénom affiché (premier mot du nom complet). */
export function prenomDe(utilisateur) {
  return String(utilisateur?.nom_complet ?? '').trim().split(/\s+/)[0] || '';
}

/** Initiales (2 lettres au plus) du nom complet. */
export function initialesDe(utilisateur) {
  const mots = String(utilisateur?.nom_complet ?? '').trim().split(/\s+/).filter(Boolean);
  return mots.map((m) => m[0]).slice(0, 2).join('').toUpperCase() || '?';
}
