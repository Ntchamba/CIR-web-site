// Pages réservées aux clients connectés : sinon, renvoi vers la connexion puis retour à la page demandée.
import { Navigate, Outlet, useLocation } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import { useTraduction } from '@/i18n/index.js';

import { useAuth } from './AuthContext.jsx';

export default function RouteProtegee({ children }) {
  const { t } = useTraduction();
  const { utilisateur, pret } = useAuth();
  const { pathname, search } = useLocation();
  if (!pret) return <Chargement plein texte={t('compte.verification')} />;
  if (!utilisateur) {
    return <Navigate to={`/connexion?suite=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return children ?? <Outlet />;
}
