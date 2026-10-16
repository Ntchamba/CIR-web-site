// BF-15, O2 : contenus du site public. Sous-pages : accueil (/contenus), bandeaux, sphère de photos.
import { Route, Routes } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import SousNavigation from '@/composants/SousNavigation.jsx';
import gestion from '@/composants/Gestion.module.css';

import SectionAccueil from './SectionAccueil.jsx';
import SectionBandeaux from './SectionBandeaux.jsx';
import SectionSphere from './SectionSphere.jsx';

export default function ContenusPage() {
  const { t } = useTraduction();
  usePageMeta(t('contenus.titre'));
  return (
    <div className={gestion.page}>
      <div>
        <h1 className="titre-page">{t('contenus.titre')}</h1>
        <p className="sous-titre-page">{t('contenus.sousTitre')}</p>
      </div>
      <SousNavigation libelle={t('contenus.sousPages')} liens={[
        { chemin: '/contenus', libelle: t('contenus.accueil.titre'), fin: true },
        { chemin: '/contenus/bandeaux', libelle: t('contenus.bandeaux.titre') },
        { chemin: '/contenus/sphere', libelle: t('contenus.sphere.titre') },
      ]} />
      <Routes>
        <Route index element={<SectionAccueil />} />
        <Route path="bandeaux" element={<SectionBandeaux />} />
        <Route path="sphere" element={<SectionSphere />} />
      </Routes>
    </div>
  );
}
