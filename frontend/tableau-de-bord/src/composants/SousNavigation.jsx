// Sous-pages d'un module (ex. Vitrine : réalisations, démos, témoignages), sous forme de liens.
import { NavLink } from 'react-router';

import styles from './Composants.module.css';

/** `liens` : [{ chemin, libelle, fin?, extra? }] ; `extra` s'affiche après le libellé (ex. compteur). */
export default function SousNavigation({ libelle, liens }) {
  return (
    <nav aria-label={libelle} className={styles.sousNavigation}>
      <ul>
        {liens.map((l) => (
          <li key={l.chemin}>
            <NavLink to={l.chemin} end={l.fin}
              className={({ isActive }) => `${styles.sousLien} ${isActive ? styles.sousLienActif : ''}`}>
              {l.libelle}
              {l.extra}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
