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
const CommandesPage = lazy(() => import('@/modules/commandes/CommandesPage.jsx'));
const DetailCommande = lazy(() => import('@/modules/commandes/DetailCommande.jsx'));
const DevisPage = lazy(() => import('@/modules/devis/DevisPage.jsx'));
const EditeurDevis = lazy(() => import('@/modules/devis/EditeurDevis.jsx'));
const DemandesPage = lazy(() => import('@/modules/contact/DemandesPage.jsx'));
const MessageriePage = lazy(() => import('@/modules/messagerie/MessageriePage.jsx'));
const AppelsEntrantsPage = lazy(() => import('@/modules/appels/AppelsEntrantsPage.jsx'));
const PaiementsPage = lazy(() => import('@/modules/paiements/PaiementsPage.jsx'));
const StatistiquesPage = lazy(() => import('@/modules/statistiques/StatistiquesPage.jsx'));
const AssistantEquipe = lazy(() => import('@/modules/assistant/AssistantEquipe.jsx'));
const JournalAssistant = lazy(() => import('@/modules/assistant/JournalAssistant.jsx'));
const NotificationsPage = lazy(() => import('@/modules/notifications/NotificationsPage.jsx'));

export default function RoutesTableauDeBord() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route path="connexion" element={<ConnexionPage />} />
        <Route element={<RouteEquipe />}>
          <Route element={<Coque />}>
            <Route index element={<AccueilPage />} />
            <Route path="commandes" element={<CommandesPage />} />
            <Route path="commandes/:id" element={<DetailCommande />} />
            <Route path="devis" element={<DevisPage />} />
            {/* Deux éléments distincts (clés différentes) : l'éditeur repart de zéro après la création d'un devis. */}
            <Route path="devis/nouveau" element={<EditeurDevis key="nouveau" />} />
            <Route path="devis/:id" element={<EditeurDevis key="existant" />} />
            <Route path="contact" element={<DemandesPage />} />
            <Route path="messagerie" element={<MessageriePage />} />
            <Route path="appels" element={<AppelsEntrantsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="paiements" element={<PaiementsPage />} />
            <Route path="statistiques" element={<StatistiquesPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<FicheClientPage />} />
            <Route path="catalogue/*" element={<CataloguePage />} />
            <Route path="vitrine/*" element={<VitrinePage />} />
            <Route path="actualites" element={<ActualitesPage />} />
            <Route path="contenus/*" element={<ContenusPage />} />
            <Route path="assistant" element={<AssistantEquipe />} />
            <Route path="assistant/journal" element={<JournalAssistant />} />
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
