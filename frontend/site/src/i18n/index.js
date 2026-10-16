// Traductions du site public : textes du site (ce dossier) + textes communs (frontend/partage/i18n).
// Le français est chargé avec le site ; les autres langues à la demande. Les composants importent
// d'ici, ce qui garantit que les textes du site sont enregistrés avant le premier rendu (tests compris).
import { enregistrerChargeurs, enregistrerMessages } from '@partage/i18n/i18n.js';

import fr from './fr.js';

enregistrerMessages('fr', fr);
enregistrerChargeurs({
  en: () => import('./en.js'),
  zh: () => import('./zh.js'),
  de: () => import('./de.js'),
  ja: () => import('./ja.js'),
});

export { changerLangue, demarrerI18n, langueCourante, t } from '@partage/i18n/i18n.js';
export { default as useTraduction } from '@partage/i18n/useTraduction.js';
