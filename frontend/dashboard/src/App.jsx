// Routes du tableau de bord. Toutes les pages, sauf la connexion, sont réservées à l'équipe.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Coque from './components/layout/Coque.jsx';
import Chargement from './components/ui/Chargement.jsx';
import { AuthProvider } from './modules/auth/AuthContext.jsx';
import ConnexionPage from './modules/auth/ConnexionPage.jsx';
import RouteEquipe from './modules/auth/RouteEquipe.jsx';

const TableauDeBordPage = lazy(() => import('./modules/tableau-de-bord/TableauDeBordPage.jsx'));
const CommandesPage = lazy(() => import('./modules/commandes/CommandesPage.jsx'));
const MessageriePage = lazy(() => import('./modules/messagerie/MessageriePage.jsx'));
const DemandesPage = lazy(() => import('./modules/demandes/DemandesPage.jsx'));
const CataloguePage = lazy(() => import('./modules/catalogue/CataloguePage.jsx'));
const ClientsPage = lazy(() => import('./modules/clients/ClientsPage.jsx'));
const ContenusPage = lazy(() => import('./modules/contenus/ContenusPage.jsx'));
const PaiementsPage = lazy(() => import('./modules/paiements/PaiementsPage.jsx'));
const AppelsPage = lazy(() => import('./modules/appels/AppelsPage.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Chargement plein />}>
          <Routes>
            <Route path="connexion" element={<ConnexionPage />} />
            <Route element={<RouteEquipe />}>
              <Route element={<Coque />}>
                <Route index element={<TableauDeBordPage />} />
                <Route path="commandes" element={<CommandesPage />} />
                <Route path="commandes/:numero" element={<CommandesPage />} />
                <Route path="messagerie" element={<MessageriePage />} />
                <Route path="messagerie/:id" element={<MessageriePage />} />
                <Route path="demandes" element={<DemandesPage />} />
                <Route path="catalogue" element={<CataloguePage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientsPage />} />
                <Route path="contenus" element={<ContenusPage />} />
                <Route path="paiements" element={<PaiementsPage />} />
                <Route path="appels" element={<AppelsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
