// Barre de navigation du bas, sur téléphone : Accueil, Catalogue, Réalisations, Commandes, Compte.
import { NavLink } from 'react-router-dom';

import { useAuth } from '@/modules/compte/AuthContext.jsx';

import Icone from '../ui/Icone.jsx';
import styles from './BarreOnglets.module.css';

export default function BarreOnglets() {
  const { utilisateur } = useAuth();
  const onglets = [
    { vers: '/', libelle: 'Accueil', icone: 'accueil', fin: true },
    { vers: '/catalogue', libelle: 'Catalogue', icone: 'catalogue' },
    { vers: '/realisations', libelle: 'Réalisations', icone: 'realisations' },
    { vers: '/commandes', libelle: 'Commandes', icone: 'commandes' },
    { vers: utilisateur ? '/compte/profil' : '/compte', libelle: 'Compte', icone: 'compte' },
  ];
  return (
    <nav className={styles.barre} aria-label="Navigation">
      {onglets.map((o) => (
        <NavLink key={o.libelle} to={o.vers} end={o.fin}
          className={({ isActive }) => `${styles.onglet} ${isActive ? styles.actif : ''}`}>
          <Icone nom={o.icone} taille={22} />
          <span>{o.libelle}</span>
        </NavLink>
      ))}
    </nav>
  );
}
