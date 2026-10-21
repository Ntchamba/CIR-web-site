// Routes du site public. Chaque page est chargée à la demande (pages plus légères, BNF-02).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import Gabarit from '@/layout/Gabarit.jsx';
import RouteProtegee from '@/modules/compte/RouteProtegee.jsx';

// Chaque page est chargée à la demande ; une fois la page d'arrivée affichée et le navigateur au repos, les autres sont
// préchargées en douce : un clic ne montre alors jamais d'écran de chargement (et le zoom entre pages, qui photographie la
// nouvelle page, la trouve prête).
const importeurs = [];
const paresseuse = (importeur) => {
  importeurs.push(importeur);
  return lazy(importeur);
};
export function prechargerPages() {
  const lancer = () => importeurs.forEach((importer) => { importer().catch(() => {}); });
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(lancer, { timeout: 4000 });
  else window.setTimeout(lancer, 1500);
}

const PageIntrouvable = paresseuse(() => import('@/layout/PageIntrouvable.jsx'));
const AccueilPage = paresseuse(() => import('@/modules/accueil/AccueilPage.jsx'));
const CataloguePage = paresseuse(() => import('@/modules/catalogue/CataloguePage.jsx'));
const ProduitPage = paresseuse(() => import('@/modules/produit/ProduitPage.jsx'));
const VitrinePage = paresseuse(() => import('@/modules/vitrine/VitrinePage.jsx'));
const ActualitesPage = paresseuse(() => import('@/modules/actualites/ActualitesPage.jsx'));
const ActualitePage = paresseuse(() => import('@/modules/actualites/ActualitePage.jsx'));
const ConnexionPage = paresseuse(() => import('@/modules/compte/ConnexionPage.jsx'));
const InscriptionPage = paresseuse(() => import('@/modules/compte/InscriptionPage.jsx'));
const ProfilPage = paresseuse(() => import('@/modules/compte/ProfilPage.jsx'));
const SelectionPage = paresseuse(() => import('@/modules/selection/SelectionPage.jsx'));
const CommandesPage = paresseuse(() => import('@/modules/commandes/CommandesPage.jsx'));
const NouvelleCommandePage = paresseuse(() => import('@/modules/commandes/NouvelleCommandePage.jsx'));
const PaiementPage = paresseuse(() => import('@/modules/paiements/PaiementPage.jsx'));
const RecuPage = paresseuse(() => import('@/modules/paiements/RecuPage.jsx'));
const DemandeRenduPage = paresseuse(() => import('@/modules/devis/DemandeRenduPage.jsx'));
const ContactPage = paresseuse(() => import('@/modules/contact/ContactPage.jsx'));
const MessageriePage = paresseuse(() => import('@/modules/messagerie/MessageriePage.jsx'));
const NotificationsPage = paresseuse(() => import('@/modules/notifications/NotificationsPage.jsx'));
const MesDemandesPage = paresseuse(() => import('@/modules/contact/MesDemandesPage.jsx'));

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
            <Route path="commandes/:id" element={<CommandesPage />} />
            <Route path="commandes/:id/payer" element={<PaiementPage />} />
            <Route path="paiements/:id/recu" element={<RecuPage />} />
            <Route path="devis/demande" element={<DemandeRenduPage />} />
            <Route path="mes-demandes" element={<MesDemandesPage />} />
            <Route path="messages" element={<MessageriePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<PageIntrouvable />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
