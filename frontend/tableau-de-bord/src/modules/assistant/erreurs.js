// Messages traduits des erreurs propres à l'assistant (429 et 503 du contrat). Les autres erreurs gardent leur message.
import { existe, t } from '@/i18n/index.js';

const CODES = {
  assistant_trop_de_messages: 'assistant.erreurs.trop',
  assistant_limite_atteinte: 'assistant.erreurs.limite',
  assistant_non_configure: 'assistant.erreurs.nonConfigure',
  assistant_indisponible: 'assistant.erreurs.indisponible',
};

/** Texte lisible d'une erreur de l'API de l'assistant (chaîne ; null s'il n'y a pas d'erreur). */
export function messageErreurAssistant(erreur) {
  if (!erreur) return null;
  const code = erreur.donnees?.code;
  if (code && CODES[code]) return t(CODES[code]);
  if (erreur.statut === 429) return t('assistant.erreurs.trop');
  if (erreur.statut === 503) return t('assistant.erreurs.indisponible');
  return erreur.message || t('assistant.erreurs.defaut');
}

/** Libellé d'un code de garde-fou (« prix_non_autorise »…), le code lui-même s'il est inconnu. */
export function libelleGardeFou(code) {
  if (!code) return '';
  return existe(`assistant.garde.${code}`) ? t(`assistant.garde.${code}`) : t('assistant.garde.autre', { code });
}

/** Ajoute `ajout` au texte déjà saisi (séparé par une ligne vide) ; ne remplace jamais ce que l'équipe a écrit. */
export function ajouterTexte(actuel, ajout) {
  const base = String(actuel || '').trimEnd();
  return base ? `${base}\n\n${ajout}` : ajout;
}
