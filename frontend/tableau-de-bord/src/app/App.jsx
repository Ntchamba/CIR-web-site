// Application du tableau de bord : session de l'équipe et routes. Le routeur est fourni par main.jsx
// (ou par un MemoryRouter dans les tests).
import { configurerPageMeta } from '@partage/utils/usePageMeta.js';

import { AuthProvider } from '@/modules/connexion/AuthContext.jsx';

import RoutesTableauDeBord from './routes.jsx';

configurerPageMeta({ suffixe: ' | Tableau de bord CIR', titreParDefaut: 'Tableau de bord | CIR' });

export default function App() {
  return (
    <AuthProvider>
      <RoutesTableauDeBord />
    </AuthProvider>
  );
}
