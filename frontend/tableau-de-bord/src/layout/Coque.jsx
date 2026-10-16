// Coque du tableau de bord : menu latéral (tiroir sur téléphone), en-tête et zone de contenu.
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import Entete from './Entete.jsx';
import MenuLateral from './MenuLateral.jsx';
import styles from './Coque.module.css';

const ID_MENU = 'menu-tableau-de-bord';

export default function Coque() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { pathname } = useLocation();

  // Le tiroir se referme à chaque changement de page et avec la touche Échap.
  useEffect(() => setMenuOuvert(false), [pathname]);
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const surTouche = (e) => e.key === 'Escape' && setMenuOuvert(false);
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [menuOuvert]);

  return (
    <div className={styles.coque}>
      <a href="#contenu" className={styles.evitement}>Aller au contenu</a>
      <MenuLateral id={ID_MENU} ouvert={menuOuvert} surNavigation={() => setMenuOuvert(false)} />
      {menuOuvert && <div className={styles.voile} onClick={() => setMenuOuvert(false)} aria-hidden="true" />}
      <div className={styles.principal}>
        <Entete idMenu={ID_MENU} menuOuvert={menuOuvert} basculerMenu={() => setMenuOuvert((o) => !o)} />
        <main id="contenu" className={styles.contenu} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
