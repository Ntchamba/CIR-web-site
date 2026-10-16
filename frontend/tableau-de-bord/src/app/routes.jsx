// Routes du tableau de bord. Tout est réservé à l'équipe, sauf la page de connexion.
// Chaque page est chargée à la demande (BNF-02).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import Coque from '@/layout/Coque.jsx';
import { MODULES_A_VENIR } from '@/layout/menu.js';
import RouteEquipe from '@/modules/connexion/RouteEquipe.jsx';

const AccueilPage = lazy(() => import('@/layout/AccueilPage.jsx'));
const BientotDisponible = lazy(() => import('@/layout/BientotDisponible.jsx'));
const PageIntrouvable = lazy(() => import('@/layout/PageIntrouvable.jsx'));
const ConnexionPage = lazy(() => import('@/modules/connexion/ConnexionPage.jsx'));
const EquipePage = lazy(() => import('@/modules/equipe/EquipePage.jsx'));
const ClientsPage = lazy(() => import('@/modules/clients/ClientsPage.jsx'));
const FicheClientPage = lazy(() => import('@/modules/clients/FicheClientPage.jsx'));
const CataloguePage = lazy(() => import('@/modules/catalogue/CataloguePage.jsx'));
const VitrinePage = lazy(() => import('@/modules/vitrine/VitrinePage.jsx'));
const ActualitesPage = lazy(() => import('@/modules/actualites/ActualitesPage.jsx'));
const ContenusPage = lazy(() => import('@/modules/contenus/ContenusPage.jsx'));

export default function RoutesTableauDeBord() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route path="connexion" element={<ConnexionPage />} />
        <Route element={<RouteEquipe />}>
          <Route element={<Coque />}>
            <Route index element={<AccueilPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<FicheClientPage />} />
            <Route path="catalogue/*" element={<CataloguePage />} />
            <Route path="vitrine/*" element={<VitrinePage />} />
            <Route path="actualites" element={<ActualitesPage />} />
            <Route path="contenus/*" element={<ContenusPage />} />
            <Route path="equipe" element={<RouteEquipe superAdmin><EquipePage /></RouteEquipe>} />
            {MODULES_A_VENIR.map((m) => (
              <Route key={m.chemin} path={m.chemin.slice(1)}
                element={<BientotDisponible module={m.module} />} />
            ))}
            <Route path="*" element={<PageIntrouvable />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
