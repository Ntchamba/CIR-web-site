// Barre d'onglets du bas (téléphone) de la maquette : Accueil, Catalogue, Réalisations, Commandes, Compte.
// La messagerie (fonction absente de la maquette) reste accessible par le menu de l'en-tête.
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
    <nav className={styles.barre} aria-label={t('nav.mobile')} data-vt="onglets">
      {ONGLETS.map((o) => (
        <NavLink key={o.vers} to={o.vers} end={o.fin} className={styles.onglet}>
          <Icone nom={o.icone} taille={22} />
          <span>{t(o.cle)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
