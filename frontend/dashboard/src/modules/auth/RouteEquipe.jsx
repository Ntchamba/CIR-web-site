// Toutes les pages du tableau de bord exigent une connexion d'un membre de l'équipe.
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import Chargement from '@/components/ui/Chargement.jsx';

import { useAuth } from './AuthContext.jsx';

export default function RouteEquipe() {
  const { utilisateur, pret } = useAuth();
  const { pathname } = useLocation();
  if (!pret) return <Chargement plein />;
  if (!utilisateur) return <Navigate to={`/connexion?suite=${encodeURIComponent(pathname)}`} replace />;
  return <Outlet />;
}
