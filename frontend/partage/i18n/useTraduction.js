// Crochet React des traductions : le composant est redessiné quand la langue change.
//   const { t, langue, changerLangue } = useTraduction();
import { useSyncExternalStore } from 'react';

import { abonner, changerLangue, langueCourante, localeIntl, t } from './i18n.js';
import { LANGUES } from './langues.js';

export default function useTraduction() {
  const langue = useSyncExternalStore(abonner, langueCourante, langueCourante);
  return { t, langue, locale: localeIntl(), changerLangue, langues: LANGUES };
}
