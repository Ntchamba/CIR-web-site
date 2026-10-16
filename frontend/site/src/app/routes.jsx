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

/** Pages des modules des vagues suivantes : simple « Bientôt disponible » en attendant. */
const A_VENIR = [
  { chemin: 'catalogue', titre: 'Catalogue', texte: 'Le catalogue des revêtements en résine époxy arrive bientôt.' },
  { chemin: 'realisations', titre: 'Réalisations', texte: 'Nos chantiers en photos arrivent bientôt.' },
];

export default function RoutesSite() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route element={<Gabarit />}>
          <Route index element={<BientotDisponible titre="Accueil"
            texte="Le CIR pose des revêtements de sol en résine époxy pour la maison, l'industrie et l'entreprise. La nouvelle vitrine arrive bientôt." />} />
          {A_VENIR.map((p) => (
            <Route key={p.chemin} path={p.chemin} element={<BientotDisponible titre={p.titre} texte={p.texte} />} />
          ))}
          <Route path="connexion" element={<ConnexionPage />} />
          <Route path="inscription" element={<InscriptionPage />} />
          <Route element={<RouteProtegee />}>
            <Route path="compte" element={<ProfilPage />} />
            <Route path="commandes" element={<BientotDisponible titre="Mes commandes"
              texte="Le suivi de vos commandes arrive bientôt." />} />
          </Route>
          <Route path="*" element={<PageIntrouvable />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
