// Règles de la vitrine côté site : contrôle d'un témoignage avant envoi, adresses d'intégration vidéo.
// Le serveur revérifie tout (moderation.py) ; ces contrôles évitent seulement un aller-retour.
import { t } from '@/i18n/index.js';

export const TEXTE_MIN = 20;
export const TEXTE_MAX = 800;

/** { texte, note } → { texte?: message, note?: message } (vide si tout va bien). */
export function validerTemoignage({ texte = '', note }) {
  const erreurs = {};
  const longueur = texte.trim().length;
  if (!longueur) erreurs.texte = t('vitrine.formulaire.erreurs.texteVide');
  else if (longueur < TEXTE_MIN) erreurs.texte = t('vitrine.formulaire.erreurs.texteCourt', { min: TEXTE_MIN });
  else if (longueur > TEXTE_MAX) erreurs.texte = t('vitrine.formulaire.erreurs.texteLong', { max: TEXTE_MAX });
  const n = Number(note);
  if (!Number.isInteger(n) || n < 1 || n > 5) erreurs.note = t('vitrine.formulaire.erreurs.note');
  return erreurs;
}

const HOTES_INTEGRATION = ['www.youtube-nocookie.com', 'youtube-nocookie.com', 'player.vimeo.com'];

/** Adresse d'intégration sûre (https, YouTube sans cookie ou Vimeo), avec lecture automatique ; sinon null. */
export function adresseIntegration(integration) {
  try {
    const url = new URL(integration);
    if (url.protocol !== 'https:' || !HOTES_INTEGRATION.includes(url.hostname)) return null;
    url.searchParams.set('autoplay', '1');
    return url.toString();
  } catch {
    return null;
  }
}
