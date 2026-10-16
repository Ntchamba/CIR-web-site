// Gabarit commun : lien d'évitement, en-tête, contenu de la page, pied de page, barre d'onglets mobile.
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import { useTraduction } from '@/i18n/index.js';

import BarreOnglets from './BarreOnglets.jsx';
import Entete from './Entete.jsx';
import PiedDePage from './PiedDePage.jsx';
import styles from './Gabarit.module.css';

export default function Gabarit() {
  const { t } = useTraduction();
  const { pathname } = useLocation();

  // Haut de page à chaque changement de page.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={styles.page}>
      <a href="#contenu" className={styles.evitement}>{t('nav.allerAuContenu')}</a>
      <Entete />
      <main id="contenu" className={styles.contenu} tabIndex={-1}>
        {/* Page chargée à la demande : l'en-tête et le pied de page restent affichés pendant le chargement. */}
        <Suspense fallback={<Chargement plein />}>
          <Outlet />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreOnglets />
    </div>
  );
}
