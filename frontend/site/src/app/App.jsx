// Application du site public : session du client et routes. Le routeur est fourni par main.jsx
// (ou par un MemoryRouter dans les tests).
import { configurerPageMeta } from '@partage/utils/usePageMeta.js';

import { AuthProvider } from '@/modules/compte/AuthContext.jsx';

import RoutesSite from './routes.jsx';

configurerPageMeta({
  suffixe: ' | CIR, sols en résine époxy',
  titreParDefaut: 'CIR : revêtements de sol en résine époxy à Douala',
});

export default function App() {
  return (
    <AuthProvider>
      <RoutesSite />
    </AuthProvider>
  );
}
