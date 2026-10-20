// Barre de navigation du bas, sur téléphone : Accueil, Catalogue, Réalisations, Commandes, Messages, Compte
// (sur un très petit écran, Compte reste accessible dans l'en-tête).
import { NavLink } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useDirect } from '@/modules/notifications/FondDirect.jsx';

import styles from './BarreOnglets.module.css';

export const ONGLETS = [
  { vers: '/', cle: 'nav.accueil', icone: 'accueil', fin: true },
  { vers: '/catalogue', cle: 'nav.catalogue', icone: 'catalogue' },
  { vers: '/realisations', cle: 'nav.realisations', icone: 'realisations' },
  { vers: '/commandes', cle: 'nav.commandes', icone: 'commandes' },
  { vers: '/messages', cle: 'nav.messages', icone: 'message', pastille: true },
  { vers: '/compte', cle: 'nav.compte', icone: 'compte', compte: true },
];

export default function BarreOnglets() {
  const { t } = useTraduction();
  const { nonLusMessages } = useDirect();
  return (
    <nav className={styles.barre} aria-label={t('nav.mobile')}>
      {ONGLETS.map((o) => (
        <NavLink key={o.vers} to={o.vers} end={o.fin}
          className={({ isActive }) => `${styles.onglet} ${isActive ? styles.actif : ''} ${o.compte ? styles.compte : ''}`}>
          <span className={styles.icone}>
            <Icone nom={o.icone} taille={22} />
            {o.pastille && nonLusMessages > 0 && (
              <span className={styles.pastille} aria-hidden="true">{nonLusMessages > 99 ? '99+' : nonLusMessages}</span>
            )}
          </span>
          <span>{t(o.cle)}</span>
          {o.pastille && nonLusMessages > 0 && (
            <span className="visuellement-cache">{t('nav.messagesNonLus', { n: nonLusMessages })}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
