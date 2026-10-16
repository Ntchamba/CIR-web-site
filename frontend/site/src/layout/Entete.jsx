// En-tête : logo, navigation principale (ordinateur), choix de la langue, accès au compte.
// Sur téléphone : logo, bouton d'appel, langue et compte ; la navigation est dans la barre d'onglets du bas.
import { Link, NavLink } from 'react-router';

import ChoixLangue from '@partage/ui/ChoixLangue.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { prenomDe } from '@/modules/compte/adresse.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import { COORDONNEES } from './coordonnees.js';
import styles from './Entete.module.css';

export const LIENS_PRINCIPAUX = [
  { vers: '/', cle: 'nav.accueil', fin: true },
  { vers: '/catalogue', cle: 'nav.catalogue' },
  { vers: '/realisations', cle: 'nav.realisations' },
  { vers: '/commandes', cle: 'nav.mesCommandes' },
];

export default function Entete() {
  const { t } = useTraduction();
  const { utilisateur, retenirLangue } = useAuth();

  return (
    <header className={styles.entete}>
      <div className={styles.barre}>
        <Link to="/" className={styles.logo} aria-label={t('entete.retourAccueil')}>
          <img src="/media/marque/logo-cir.webp" alt="" width="44" height="44" />
          <span className={styles.nom}>
            <strong>CIR</strong>
            <span>{t('marque.nom')}</span>
          </span>
        </Link>

        <nav aria-label={t('nav.principale')} className={styles.nav}>
          {LIENS_PRINCIPAUX.map((l) => (
            <NavLink key={l.vers} to={l.vers} end={l.fin}
              className={({ isActive }) => `${styles.lien} ${isActive ? styles.actif : ''}`}>
              {t(l.cle)}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <ChoixLangue className={styles.langue} surChangement={retenirLangue} />
          <a href={COORDONNEES.lienTelephone} className={styles.boutonRond}
            aria-label={t('entete.appeler', { telephone: COORDONNEES.telephone })}>
            <Icone nom="tel" />
          </a>
          {utilisateur ? (
            <Link to="/compte" className={styles.compte}>
              <Icone nom="compte" />
              <span>{prenomDe(utilisateur) || t('entete.monCompte')}</span>
            </Link>
          ) : (
            <Link to="/connexion" className={styles.connexion}>{t('entete.seConnecter')}</Link>
          )}
        </div>
      </div>
    </header>
  );
}
