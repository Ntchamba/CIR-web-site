// Routes du site public. Chaque page est chargée à la demande (pages plus légères, BNF-02).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import Gabarit from '@/layout/Gabarit.jsx';
import RouteProtegee from '@/modules/compte/RouteProtegee.jsx';

const BientotDisponible = lazy(() => import('@/layout/BientotDisponible.jsx'));
const PageIntrouvable = lazy(() => import('@/layout/PageIntrouvable.jsx'));
const ConnexionPage = lazy(() => import('@/modules/compte/ConnexionPage.jsx'));
const InscriptionPage = lazy(() => import('@/modules/compte/InscriptionPage.jsx'));
const ProfilPage = lazy(() => import('@/modules/compte/ProfilPage.jsx'));

/** Pages des modules des vagues suivantes : simple « Bientôt disponible » en attendant (textes : pages.<page>). */
const A_VENIR = ['catalogue', 'realisations'];

export default function RoutesSite() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route element={<Gabarit />}>
          <Route index element={<BientotDisponible page="accueil" />} />
          {A_VENIR.map((page) => (
            <Route key={page} path={page} element={<BientotDisponible page={page} />} />
          ))}
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
