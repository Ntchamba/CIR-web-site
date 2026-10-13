// En-tête : logo, navigation (Accueil, Catalogue, Réalisations, Contact, Mes commandes), compte.
// Transparent par-dessus les grandes images, opaque dès qu'on fait défiler la page.
// Sur téléphone : bouton d'appel et menu déroulant (la navigation principale est dans la barre du bas).
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import useDefilement from '@/hooks/useDefilement.js';
import PanneauAppel from '@/modules/appels/PanneauAppel.jsx';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import useNonLus from '@/modules/messagerie/useNonLus.js';
import { useSelection } from '@/modules/selection/SelectionContext.jsx';

import Icone from '../ui/Icone.jsx';
import styles from './Entete.module.css';

const LIENS = [
  { vers: '/', libelle: 'Accueil', fin: true },
  { vers: '/catalogue', libelle: 'Catalogue' },
  { vers: '/realisations', libelle: 'Réalisations' },
  { vers: '/#contact', libelle: 'Contact', ancre: true },
  { vers: '/commandes', libelle: 'Mes commandes' },
];

export default function Entete({ transparent }) {
  const { utilisateur } = useAuth();
  const { nombre } = useSelection();
  const nonLus = useNonLus();
  const defile = useDefilement(40);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [appelOuvert, setAppelOuvert] = useState(false);
  const { pathname } = useLocation();
  const clair = !transparent || defile || menuOuvert;

  useEffect(() => setMenuOuvert(false), [pathname]);

  return (
    <header className={`${styles.entete} ${clair ? styles.opaque : styles.transparent}`}>
      <div className={styles.barre}>
        <Link to="/" className={styles.logo} aria-label="CIR, accueil">
          <img src="/media/marque/logo-cir.webp" alt="" width="48" height="48" />
          <span className={styles.nom}>
            <strong>CIR</strong>
            <span>Complexe Industriel Révélation</span>
          </span>
        </Link>

        <nav aria-label="Navigation principale" className={styles.nav}>
          {LIENS.map((l) => (l.ancre
            ? <Link key={l.vers} to={l.vers} className={styles.lien}>{l.libelle}</Link>
            : (
              <NavLink key={l.vers} to={l.vers} end={l.fin}
                className={({ isActive }) => `${styles.lien} ${isActive ? styles.actif : ''}`}>
                {l.libelle}
              </NavLink>
            )))}
          {utilisateur && (
            <NavLink to="/messagerie" className={({ isActive }) => `${styles.icone} ${isActive ? styles.actif : ''}`}
              aria-label={`Messagerie${nonLus ? ` : ${nonLus} non lu${nonLus > 1 ? 's' : ''}` : ''}`}>
              <Icone nom="message" />
              {nonLus > 0 && <span className={styles.pastille}>{nonLus}</span>}
            </NavLink>
          )}
          {nombre > 0 && (
            <NavLink to="/commandes/nouvelle" className={styles.icone} aria-label={`Ma sélection : ${nombre} produit(s)`}>
              <Icone nom="coeur" />
              <span className={styles.pastille}>{nombre}</span>
            </NavLink>
          )}
          {utilisateur
            ? <Link to="/compte/profil" className={styles.compte}>{utilisateur.nom_complet.split(' ')[0]}</Link>
            : <Link to="/compte" className={styles.connexion}>Se connecter</Link>}
        </nav>

        <div className={styles.actionsMobile}>
          <button type="button" className={styles.boutonRond} onClick={() => setAppelOuvert(true)}
            aria-label="Appeler le CIR">
            <Icone nom="tel" />
          </button>
          <button type="button" className={styles.boutonRond} aria-expanded={menuOuvert} aria-controls="menu-mobile"
            onClick={() => setMenuOuvert((o) => !o)} aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}>
            <Icone nom={menuOuvert ? 'fermer' : 'menu'} />
          </button>
        </div>
      </div>

      {menuOuvert && (
        <nav id="menu-mobile" className={styles.menuMobile} aria-label="Menu">
          {LIENS.map((l) => <Link key={l.vers} to={l.vers}>{l.libelle}</Link>)}
          {utilisateur && <Link to="/messagerie">Messagerie{nonLus ? ` (${nonLus})` : ''}</Link>}
          {nombre > 0 && <Link to="/commandes/nouvelle">Ma sélection ({nombre})</Link>}
          <Link to={utilisateur ? '/compte/profil' : '/compte'} className={styles.menuCompte}>
            {utilisateur ? 'Mon compte' : 'Se connecter'}
          </Link>
        </nav>
      )}

      {appelOuvert && <PanneauAppel onFermer={() => setAppelOuvert(false)} />}
    </header>
  );
}
