// BF-02, BF-03, BF-04, BF-15 : vitrine. Sous-pages : réalisations, démos, témoignages (avec le nombre de
// témoignages en attente de modération).
import { Navigate, Route, Routes } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import SousNavigation from '@/composants/SousNavigation.jsx';
import gestion from '@/composants/Gestion.module.css';

import DemosPage from './DemosPage.jsx';
import RealisationsPage from './RealisationsPage.jsx';
import TemoignagesPage from './TemoignagesPage.jsx';
import { useEnAttente } from './useVitrine.js';
import styles from './Vitrine.module.css';

export default function VitrinePage() {
  const { t } = useTraduction();
  usePageMeta(t('vitrine.titre'));
  const enAttente = useEnAttente();

  return (
    <div className={gestion.page}>
      <div>
        <h1 className="titre-page">{t('vitrine.titre')}</h1>
        <p className="sous-titre-page">{t('vitrine.sousTitre')}</p>
      </div>
      <SousNavigation libelle={t('vitrine.sousPages')} liens={[
        { chemin: '/vitrine/realisations', libelle: t('vitrine.realisations.titre') },
        { chemin: '/vitrine/demos', libelle: t('vitrine.demos.titre') },
        {
          chemin: '/vitrine/temoignages',
          libelle: t('vitrine.temoignages.titre'),
          extra: enAttente.nombre > 0 ? (
            <span className={styles.compteur}>{t('vitrine.temoignages.enAttente', { n: enAttente.nombre })}</span>
          ) : null,
        },
      ]} />
      <Routes>
        <Route index element={<Navigate to="realisations" replace />} />
        <Route path="realisations" element={<RealisationsPage />} />
        <Route path="demos" element={<DemosPage />} />
        <Route path="temoignages" element={<TemoignagesPage surModeration={enAttente.actualiser} />} />
      </Routes>
    </div>
  );
}
