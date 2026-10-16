// Routes du site public. Chaque page est chargée à la demande (pages plus légères, BNF-02).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import Gabarit from '@/layout/Gabarit.jsx';
import RouteProtegee from '@/modules/compte/RouteProtegee.jsx';

const BientotDisponible = lazy(() => import('@/layout/BientotDisponible.jsx'));
const PageIntrouvable = lazy(() => import('@/layout/PageIntrouvable.jsx'));
const AccueilPage = lazy(() => import('@/modules/accueil/AccueilPage.jsx'));
const CataloguePage = lazy(() => import('@/modules/catalogue/CataloguePage.jsx'));
const ProduitPage = lazy(() => import('@/modules/produit/ProduitPage.jsx'));
const VitrinePage = lazy(() => import('@/modules/vitrine/VitrinePage.jsx'));
const ActualitesPage = lazy(() => import('@/modules/actualites/ActualitesPage.jsx'));
const ActualitePage = lazy(() => import('@/modules/actualites/ActualitePage.jsx'));
const ConnexionPage = lazy(() => import('@/modules/compte/ConnexionPage.jsx'));
const InscriptionPage = lazy(() => import('@/modules/compte/InscriptionPage.jsx'));
const ProfilPage = lazy(() => import('@/modules/compte/ProfilPage.jsx'));

export default function RoutesSite() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route element={<Gabarit />}>
          <Route index element={<AccueilPage />} />
          <Route path="catalogue" element={<CataloguePage />} />
          <Route path="catalogue/:slug" element={<ProduitPage />} />
          <Route path="realisations" element={<VitrinePage />} />
          <Route path="actualites" element={<ActualitesPage />} />
          <Route path="actualites/:slug" element={<ActualitePage />} />
          <Route path="connexion" element={<ConnexionPage />} />
          <Route path="inscription" element={<InscriptionPage />} />
          <Route element={<RouteProtegee />}>
            <Route path="compte" element={<ProfilPage />} />
            <Route path="commandes" element={<BientotDisponible page="commandes" />} />
          </Route>
          <Route path="*" element={<PageIntrouvable />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
