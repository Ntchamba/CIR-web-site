// Traductions du tableau de bord : textes du tableau de bord (ce dossier) + textes communs
// (frontend/partage/i18n). Le français est chargé avec l'application ; les autres langues à la demande.
import { enregistrerChargeurs, enregistrerMessages } from '@partage/i18n/i18n.js';

import fr from './fr.js';

enregistrerMessages('fr', fr);
enregistrerChargeurs({
  en: () => import('./en.js'),
  zh: () => import('./zh.js'),
  de: () => import('./de.js'),
  ja: () => import('./ja.js'),
});

export { changerLangue, demarrerI18n, existe, langueCourante, localeIntl, t } from '@partage/i18n/i18n.js';
export { default as useTraduction } from '@partage/i18n/useTraduction.js';
