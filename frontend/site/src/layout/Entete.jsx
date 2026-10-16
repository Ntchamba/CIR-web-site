// En-tête : logo, navigation principale (ordinateur), accès au compte.
// Sur téléphone : logo, bouton d'appel et compte ; la navigation est dans la barre d'onglets du bas.
import { Link, NavLink } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { prenomDe } from '@/modules/compte/adresse.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import { COORDONNEES } from './coordonnees.js';
import styles from './Entete.module.css';

export const LIENS_PRINCIPAUX = [
  { vers: '/', libelle: 'Accueil', fin: true },
  { vers: '/catalogue', libelle: 'Catalogue' },
  { vers: '/realisations', libelle: 'Réalisations' },
  { vers: '/commandes', libelle: 'Mes commandes' },
];

export default function Entete() {
  const { utilisateur } = useAuth();

  return (
    <header className={styles.entete}>
      <div className={styles.barre}>
        <Link to="/" className={styles.logo} aria-label="CIR, retour à l'accueil">
          <img src="/media/marque/logo-cir.webp" alt="" width="44" height="44" />
          <span className={styles.nom}>
            <strong>CIR</strong>
            <span>Complexe Industriel Révélation</span>
          </span>
        </Link>

        <nav aria-label="Navigation principale" className={styles.nav}>
          {LIENS_PRINCIPAUX.map((l) => (
            <NavLink key={l.vers} to={l.vers} end={l.fin}
              className={({ isActive }) => `${styles.lien} ${isActive ? styles.actif : ''}`}>
              {l.libelle}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <a href={COORDONNEES.lienTelephone} className={styles.boutonRond}
            aria-label={`Appeler le CIR au ${COORDONNEES.telephone}`}>
            <Icone nom="tel" />
          </a>
          {utilisateur ? (
            <Link to="/compte" className={styles.compte}>
              <Icone nom="compte" />
              <span>{prenomDe(utilisateur) || 'Mon compte'}</span>
            </Link>
          ) : (
            <Link to="/connexion" className={styles.connexion}>Se connecter</Link>
          )}
        </div>
      </div>
    </header>
  );
}
