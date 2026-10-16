// BF-01, BF-05, BF-06, BF-14 : gestion du catalogue. Sous-pages : produits (/catalogue) et familles
// (/catalogue/familles). Les familles sont chargées une fois pour les deux.
import { Route, Routes } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import SousNavigation from '@/composants/SousNavigation.jsx';
import gestion from '@/composants/Gestion.module.css';

import ListeFamilles from './composants/ListeFamilles.jsx';
import ListeProduits from './composants/ListeProduits.jsx';
import { useFamilles } from './useCatalogue.js';

export default function CataloguePage() {
  const { t } = useTraduction();
  usePageMeta(t('catalogue.titre'));
  const familles = useFamilles();

  return (
    <div className={gestion.page}>
      <div>
        <h1 className="titre-page">{t('catalogue.titre')}</h1>
        <p className="sous-titre-page">{t('catalogue.sousTitre')}</p>
      </div>
      <SousNavigation libelle={t('catalogue.sousPages')} liens={[
        { chemin: '/catalogue', libelle: t('catalogue.produits.titre'), fin: true },
        { chemin: '/catalogue/familles', libelle: t('catalogue.familles.titre') },
      ]} />
      <Routes>
        <Route index element={<ListeProduits familles={familles.familles} surChangementFamilles={familles.recharger} />} />
        <Route path="familles" element={<ListeFamilles etat={familles} />} />
      </Routes>
    </div>
  );
}
