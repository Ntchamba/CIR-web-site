// Pages réservées à l'équipe : sinon, renvoi vers la connexion puis retour à la page demandée.
// `superAdmin` : réservé au super-administrateur (les autres membres voient un message d'accès refusé).
import { Link, Navigate, Outlet, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';

import { useTraduction } from '@/i18n/index.js';

import { useAuth } from './AuthContext.jsx';

export default function RouteEquipe({ superAdmin = false, children }) {
  const { t } = useTraduction();
  const { utilisateur, pret, superAdmin: estSuperAdmin } = useAuth();
  const { pathname, search } = useLocation();
  if (!pret) return <Chargement plein texte={t('connexion.verification')} />;
  if (!utilisateur) {
    const suite = pathname + search;
    return <Navigate to={suite === '/' ? '/connexion' : `/connexion?suite=${encodeURIComponent(suite)}`} replace />;
  }
  if (superAdmin && !estSuperAdmin) {
    return (
      <EtatVide titre={t('connexion.reserve')} niveau={1}
        action={<Bouton as={Link} to="/" variante="contour">{t('connexion.retour')}</Bouton>}>
        {t('connexion.reserveTexte')}
      </EtatVide>
    );
  }
  return children ?? <Outlet />;
}
