// Menu latéral : modules livrés, puis modules à venir marqués « Bientôt disponible ».
import { NavLink } from 'react-router';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import IconeMenu from './IconeMenu.jsx';
import { MODULES_A_VENIR, modulesVisibles } from './menu.js';
import styles from './Coque.module.css';

const classeLien = ({ isActive }) => `${styles.lien} ${isActive ? styles.actif : ''}`;

export default function MenuLateral({ id, ouvert, surNavigation }) {
  const { t } = useTraduction();
  const { superAdmin } = useAuth();
  return (
    <nav id={id} className={`${styles.menu} ${ouvert ? styles.menuOuvert : ''}`} aria-label={t('coque.menu')}>
      <NavLink to="/" className={styles.logo} onClick={surNavigation}>
        <img src="/media/marque/logo-cir.webp" alt="" width="40" height="40" />
        <span><strong>CIR</strong><small>{t('coque.tableauDeBord')}</small></span>
      </NavLink>

      <p className={styles.section}>{t('coque.pilotage')}</p>
      <ul className={styles.liste}>
        {modulesVisibles(superAdmin).map((m) => (
          <li key={m.chemin}>
            <NavLink to={m.chemin} end={m.fin} className={classeLien} onClick={surNavigation}>
              <IconeMenu nom={m.icone} />
              <span>{m.libelle}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <p className={styles.section}>{t('coque.aVenir')}</p>
      <ul className={styles.liste}>
        {MODULES_A_VENIR.map((m) => (
          <li key={m.chemin}>
            <NavLink to={m.chemin} className={classeLien} onClick={surNavigation}>
              <IconeMenu nom={m.icone} />
              <span>{m.libelle}</span>
              <span className={styles.bientot}>{t('coque.bientot')}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
