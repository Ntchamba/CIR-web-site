// Pages réservées aux clients connectés : sinon, renvoi vers la connexion puis retour à la page demandée.
import { Navigate, Outlet, useLocation } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import { useAuth } from './AuthContext.jsx';

export default function RouteProtegee({ children }) {
  const { utilisateur, pret } = useAuth();
  const { pathname, search } = useLocation();
  if (!pret) return <Chargement plein texte="Vérification de votre session…" />;
  if (!utilisateur) {
    return <Navigate to={`/connexion?suite=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return children ?? <Outlet />;
}
