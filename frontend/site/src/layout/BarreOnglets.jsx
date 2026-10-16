// Barre de navigation du bas, sur téléphone : Accueil, Catalogue, Réalisations, Commandes, Compte.
import { NavLink } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from './BarreOnglets.module.css';

export const ONGLETS = [
  { vers: '/', cle: 'nav.accueil', icone: 'accueil', fin: true },
  { vers: '/catalogue', cle: 'nav.catalogue', icone: 'catalogue' },
  { vers: '/realisations', cle: 'nav.realisations', icone: 'realisations' },
  { vers: '/commandes', cle: 'nav.commandes', icone: 'commandes' },
  { vers: '/compte', cle: 'nav.compte', icone: 'compte' },
];

export default function BarreOnglets() {
  const { t } = useTraduction();
  return (
    <nav className={styles.barre} aria-label={t('nav.mobile')}>
      {ONGLETS.map((o) => (
        <NavLink key={o.vers} to={o.vers} end={o.fin}
          className={({ isActive }) => `${styles.onglet} ${isActive ? styles.actif : ''}`}>
          <Icone nom={o.icone} taille={22} />
          <span>{t(o.cle)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
