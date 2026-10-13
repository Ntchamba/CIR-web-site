// Gabarit commun : en-tête, contenu de la page (sur le fond maison), pied de page, barre d'onglets mobile.
import { useEffect } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router-dom';

import BarreOnglets from './BarreOnglets.jsx';
import Entete from './Entete.jsx';
import PiedDePage from './PiedDePage.jsx';
import styles from './Layout.module.css';

// Pages qui commencent par une grande image : l'en-tête est transparent par-dessus.
const PAGES_A_BANDEAU = ['/', '/catalogue', '/catalogue/:slug', '/realisations', '/commandes', '/commandes/:numero'];

export default function Layout() {
  const { pathname, hash } = useLocation();
  const bandeau = PAGES_A_BANDEAU.some((motif) => matchPath(motif, pathname));

  // Haut de page à chaque changement de page ; défilement vers l'ancre (#contact) s'il y en a une.
  useEffect(() => {
    if (hash) {
      const cible = () => document.getElementById(hash.slice(1));
      const essai = setTimeout(() => cible()?.scrollIntoView({ behavior: 'smooth' }), 80);
      return () => clearTimeout(essai);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);

  return (
    <div className={styles.page}>
      <a href="#contenu" className={styles.evitement}>Aller au contenu</a>
      <Entete transparent={bandeau} />
      <main id="contenu" className={`fond-maison ${styles.contenu} ${bandeau ? '' : styles.sousEntete}`}>
        <Outlet />
      </main>
      <PiedDePage />
      <BarreOnglets />
    </div>
  );
}
