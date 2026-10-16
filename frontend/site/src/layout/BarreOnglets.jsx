// Barre de navigation du bas, sur téléphone : Accueil, Catalogue, Réalisations, Commandes, Compte.
import { NavLink } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import styles from './BarreOnglets.module.css';

export const ONGLETS = [
  { vers: '/', libelle: 'Accueil', icone: 'accueil', fin: true },
  { vers: '/catalogue', libelle: 'Catalogue', icone: 'catalogue' },
  { vers: '/realisations', libelle: 'Réalisations', icone: 'realisations' },
  { vers: '/commandes', libelle: 'Commandes', icone: 'commandes' },
  { vers: '/compte', libelle: 'Compte', icone: 'compte' },
];

export default function BarreOnglets() {
  return (
    <nav className={styles.barre} aria-label="Navigation mobile">
      {ONGLETS.map((o) => (
        <NavLink key={o.vers} to={o.vers} end={o.fin}
          className={({ isActive }) => `${styles.onglet} ${isActive ? styles.actif : ''}`}>
          <Icone nom={o.icone} taille={22} />
          <span>{o.libelle}</span>
        </NavLink>
      ))}
    </nav>
  );
}
