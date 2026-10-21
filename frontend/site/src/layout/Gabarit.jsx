// Gabarit commun : lien d'évitement, en-tête, contenu de la page, pied de page, barre d'onglets mobile.
import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import { useTraduction } from '@/i18n/index.js';
import SalleAppel from '@/modules/appels/composants/SalleAppel.jsx';
import BandeauDirect from '@/modules/notifications/composants/BandeauDirect.jsx';

import BarreOnglets from './BarreOnglets.jsx';
import Entete from './Entete.jsx';
import PiedDePage from './PiedDePage.jsx';
import styles from './Gabarit.module.css';

// L'assistant est dans un chunk séparé, demandé seulement quand le navigateur est au repos : il ne retarde pas la page.
const BulleAssistant = lazy(() => import('@/modules/assistant/BulleAssistant.jsx'));

export default function Gabarit() {
  const { t } = useTraduction();
  const { pathname } = useLocation();

  // Haut de page à chaque changement de page.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, [pathname]);

  const [assistantPret, setAssistantPret] = useState(false);
  useEffect(() => {
    const demander = window.requestIdleCallback
      ? (rappel) => window.requestIdleCallback(rappel, { timeout: 2000 })
      : (rappel) => window.setTimeout(rappel, 200);
    const annuler = window.cancelIdleCallback || window.clearTimeout;
    const id = demander(() => setAssistantPret(true));
    return () => annuler(id);
  }, []);

  return (
    <div className={styles.page}>
      <a href="#contenu" className={styles.evitement}>{t('nav.allerAuContenu')}</a>
      <Entete />
      <main id="contenu" className={styles.contenu} tabIndex={-1}>
        <BandeauDirect />
        {/* Page chargée à la demande : l'en-tête et le pied de page restent affichés pendant le chargement. */}
        <Suspense fallback={<Chargement plein />}>
          <Outlet />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreOnglets />
      <SalleAppel />
      {assistantPret && (
        <Suspense fallback={null}>
          <BulleAssistant />
        </Suspense>
      )}
    </div>
  );
}
