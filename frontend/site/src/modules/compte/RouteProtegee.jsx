// Pages réservées aux clients connectés : sinon, renvoi vers la connexion puis retour à la page demandée.
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import Chargement from '@/components/ui/Chargement.jsx';

import { useAuth } from './AuthContext.jsx';

export default function RouteProtegee() {
  const { utilisateur, pret } = useAuth();
  const { pathname } = useLocation();
  if (!pret) return <Chargement plein />;
  if (!utilisateur) return <Navigate to={`/compte?suite=${encodeURIComponent(pathname)}`} replace />;
  return <Outlet />;
}
