// Application du site public : session du client et routes. Le routeur est fourni par main.jsx
// (ou par un MemoryRouter dans les tests).
import { configurerPageMeta } from '@partage/utils/usePageMeta.js';

import { t } from '@/i18n/index.js';
import { AppelProvider } from '@/modules/appels/AppelContext.jsx';
import { AuthProvider } from '@/modules/compte/AuthContext.jsx';
import FondDirect from '@/modules/notifications/FondDirect.jsx';
import { SelectionProvider } from '@/modules/selection/SelectionContext.jsx';

import RoutesSite from './routes.jsx';

configurerPageMeta({
  suffixe: () => t('meta.suffixe'),
  titreParDefaut: () => t('meta.titreParDefaut'),
});

export default function App() {
  return (
    <AuthProvider>
      <FondDirect>
        <AppelProvider>
          <SelectionProvider>
            <RoutesSite />
          </SelectionProvider>
        </AppelProvider>
      </FondDirect>
    </AuthProvider>
  );
}
