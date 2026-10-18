// Routes du site public. Chaque page est chargée à la demande (pages plus légères, BNF-02).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import Gabarit from '@/layout/Gabarit.jsx';
import RouteProtegee from '@/modules/compte/RouteProtegee.jsx';

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
const SelectionPage = lazy(() => import('@/modules/selection/SelectionPage.jsx'));
const CommandesPage = lazy(() => import('@/modules/commandes/CommandesPage.jsx'));
const NouvelleCommandePage = lazy(() => import('@/modules/commandes/NouvelleCommandePage.jsx'));
const DetailCommande = lazy(() => import('@/modules/commandes/DetailCommande.jsx'));
const DemandeRenduPage = lazy(() => import('@/modules/devis/DemandeRenduPage.jsx'));
const ContactPage = lazy(() => import('@/modules/contact/ContactPage.jsx'));
const MesDemandesPage = lazy(() => import('@/modules/contact/MesDemandesPage.jsx'));

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
          <Route path="contact" element={<ContactPage />} />
          <Route element={<RouteProtegee />}>
            <Route path="compte" element={<ProfilPage />} />
            <Route path="selection" element={<SelectionPage />} />
            <Route path="commandes" element={<CommandesPage />} />
            <Route path="commandes/nouvelle" element={<NouvelleCommandePage />} />
            <Route path="commandes/:id" element={<DetailCommande />} />
            <Route path="devis/demande" element={<DemandeRenduPage />} />
            <Route path="mes-demandes" element={<MesDemandesPage />} />
          </Route>
          <Route path="*" element={<PageIntrouvable />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
