// Sous-navigation du module : brouillons et usage, journal.
import SousNavigation from '@/composants/SousNavigation.jsx';
import { useTraduction } from '@/i18n/index.js';

export default function NavigationAssistant() {
  const { t } = useTraduction();
  return (
    <SousNavigation libelle={t('assistant.navigation')} liens={[
      { chemin: '/assistant', libelle: t('assistant.liens.equipe'), fin: true },
      { chemin: '/assistant/journal', libelle: t('assistant.liens.journal') },
    ]} />
  );
}
