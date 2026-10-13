// Routes du site public. Chaque page est chargée à la demande (pages plus légères, BNF-02).
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Layout from './components/layout/Layout.jsx';
import Chargement from './components/ui/Chargement.jsx';
import { AuthProvider } from './modules/compte/AuthContext.jsx';
import RouteProtegee from './modules/compte/RouteProtegee.jsx';
import { SelectionProvider } from './modules/selection/SelectionContext.jsx';
import AccueilPage from './modules/accueil/AccueilPage.jsx';

const CataloguePage = lazy(() => import('./modules/catalogue/CataloguePage.jsx'));
const ProduitPage = lazy(() => import('./modules/produit/ProduitPage.jsx'));
const RealisationsPage = lazy(() => import('./modules/realisations/RealisationsPage.jsx'));
const ComptePage = lazy(() => import('./modules/compte/ComptePage.jsx'));
const ProfilPage = lazy(() => import('./modules/compte/ProfilPage.jsx'));
const CommandesPage = lazy(() => import('./modules/commandes/CommandesPage.jsx'));
const NouvelleCommandePage = lazy(() => import('./modules/commandes/NouvelleCommandePage.jsx'));
const MessageriePage = lazy(() => import('./modules/messagerie/MessageriePage.jsx'));
const PageIntrouvable = lazy(() => import('./components/layout/PageIntrouvable.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SelectionProvider>
          <Suspense fallback={<Chargement plein />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<AccueilPage />} />
                <Route path="catalogue" element={<CataloguePage />} />
                <Route path="catalogue/:slug" element={<ProduitPage />} />
                <Route path="realisations" element={<RealisationsPage />} />
                <Route path="compte" element={<ComptePage />} />
                <Route element={<RouteProtegee />}>
                  <Route path="compte/profil" element={<ProfilPage />} />
                  <Route path="commandes" element={<CommandesPage />} />
                  <Route path="commandes/nouvelle" element={<NouvelleCommandePage />} />
                  <Route path="commandes/:numero" element={<CommandesPage />} />
                  <Route path="messagerie" element={<MessageriePage />} />
                  <Route path="messagerie/:id" element={<MessageriePage />} />
                </Route>
                <Route path="*" element={<PageIntrouvable />} />
              </Route>
            </Routes>
          </Suspense>
        </SelectionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
