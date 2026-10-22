// En-tête de la maquette. Ordinateur : barre fixe, transparente à liens blancs sur les pages qui commencent par une
// grande image (tant qu'on n'a pas défilé), claire sinon ; logo, cinq liens, « Se connecter ». Téléphone : logo « CIR »,
// icône Contact, bouton Menu (liste de liens en Lora). Les fonctions qui n'existent pas dans les maquettes (langue,
// sélection, messages, notifications, compte) gardent leur place avec le même style.
import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import ChoixLangue from '@partage/ui/ChoixLangue.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { nomDeVue } from '@/app/cameras.js';
import { useEcranTelephone } from '@/app/preferences.js';
import { useTraduction } from '@/i18n/index.js';
import { prenomDe } from '@/modules/compte/adresse.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import CentreNotifications from '@/modules/notifications/composants/CentreNotifications.jsx';
import { useDirect } from '@/modules/notifications/FondDirect.jsx';
import { useSelection } from '@/modules/selection/SelectionContext.jsx';

import BoutonRetour from './BoutonRetour.jsx';
import styles from './Entete.module.css';

export const LIENS_PRINCIPAUX = [
  { vers: '/', cle: 'nav.accueil', fin: true },
  { vers: '/catalogue', cle: 'nav.catalogue' },
  { vers: '/realisations', cle: 'nav.realisations' },
  { vers: '/contact', cle: 'nav.contact' },
  { vers: '/commandes', cle: 'nav.mesCommandes' },
];

// Pages qui commencent par une grande image : l'en-tête y est transparent tant qu'on n'a pas défilé.
const SUR_IMAGE = ['accueil', 'catalogue', 'produit', 'realisations', 'commandes', 'commande'];

export default function Entete() {
  const { t } = useTraduction();
  const { pathname } = useLocation();
  const { utilisateur, retenirLangue } = useAuth();
  const selection = useSelection();
  const { nonLusMessages } = useDirect();
  const telephone = useEcranTelephone();
  const idMenu = useId();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [enHaut, setEnHaut] = useState(() => typeof window === 'undefined' || (window.scrollY ?? 0) < 60);

  useEffect(() => {
    const regler = () => setEnHaut((window.scrollY ?? 0) < 60);
    regler();
    window.addEventListener('scroll', regler, { passive: true });
    return () => window.removeEventListener('scroll', regler);
  }, []);
  useEffect(() => setMenuOuvert(false), [pathname]);
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const surTouche = (e) => { if (e.key === 'Escape') setMenuOuvert(false); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [menuOuvert]);

  // Téléphone : seul le haut de l'accueil (sur la vidéo) a un en-tête transparent ; ailleurs il est clair.
  const vue = nomDeVue(pathname);
  const transparent = (telephone ? vue === 'accueil' : SUR_IMAGE.includes(vue)) && enHaut && !menuOuvert;
  const classes = [styles.entete, transparent ? styles.transparent : styles.clair, menuOuvert ? styles.ouvert : ''].join(' ');
  const compte = utilisateur
    ? <Link to="/compte" className={styles.compte}><Icone nom="compte" taille={18} /><span>{prenomDe(utilisateur) || t('entete.monCompte')}</span></Link>
    : <Link to="/connexion" className={styles.connexion}>{t('entete.seConnecter')}</Link>;

  return (
    <header className={classes} data-vt="entete">
      <div className={styles.barre}>
        <BoutonRetour />
        <Link to="/" className={styles.marque} aria-label={t('entete.retourAccueil')}>
          <img src="/media/marque/logo-cir.webp" alt="" width="46" height="46" />
          <span><b>CIR</b><small>{t('marque.nom')}</small></span>
        </Link>

        <nav aria-label={t('nav.principale')} className={styles.nav}>
          {LIENS_PRINCIPAUX.map((l) => (
            <NavLink key={l.vers} to={l.vers} end={l.fin} className={styles.lien}>{t(l.cle)}</NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <ChoixLangue className={styles.langue} surChangement={retenirLangue} />
          {selection.disponible && (
            <Link to="/selection" className={styles.icone} aria-label={t('selection.compteur', { n: selection.nombre })}>
              <Icone nom="selection" />
              {selection.nombre > 0 && <span className={styles.compteur} aria-hidden="true">{selection.nombre}</span>}
            </Link>
          )}
          {utilisateur && (
            <Link to="/messages" className={`${styles.icone} ${styles.messages}`}
              aria-label={nonLusMessages > 0 ? t('entete.messagesNonLus', { n: nonLusMessages }) : t('entete.messages')}>
              <Icone nom="message" />
              {nonLusMessages > 0 && <span className={styles.compteur} aria-hidden="true">{nonLusMessages > 99 ? '99+' : nonLusMessages}</span>}
            </Link>
          )}
          {utilisateur && !utilisateur.est_equipe && <span className={styles.notifications}><CentreNotifications /></span>}
          <span className={styles.compteDesktop}>{compte}</span>
          <Link to="/contact" className={`${styles.icone} ${styles.contactTel}`} aria-label={t('nav.contact')}>
            <Icone nom="tel" taille={22} />
          </Link>
          <button type="button" className={`${styles.icone} ${styles.menu}`} aria-expanded={menuOuvert} aria-controls={idMenu}
            aria-label={utilisateur && nonLusMessages > 0 ? `${t('entete.menu')}, ${t('entete.messagesNonLus', { n: nonLusMessages })}` : t('entete.menu')}
            onClick={() => setMenuOuvert((o) => !o)}>
            <Icone nom="menu" taille={24} epaisseur={2} />
            {utilisateur && nonLusMessages > 0 && <span className={styles.compteur} aria-hidden="true">{nonLusMessages > 99 ? '99+' : nonLusMessages}</span>}
          </button>
        </div>
      </div>

      {menuOuvert && (
        <nav id={idMenu} aria-label={t('nav.principale')} className={styles.liste}>
          {LIENS_PRINCIPAUX.map((l) => (
            <NavLink key={l.vers} to={l.vers} end={l.fin}>{t(l.cle)}</NavLink>
          ))}
          {utilisateur && <Link to="/messages" className={styles.secondaire}>{nonLusMessages > 0 ? t('entete.messagesNonLus', { n: nonLusMessages }) : t('entete.messages')}</Link>}
          {selection.disponible && <Link to="/selection" className={styles.secondaire}>{t('selection.compteur', { n: selection.nombre })}</Link>}
          <div className={styles.langueMenu}><ChoixLangue surChangement={retenirLangue} /></div>
          <Link to={utilisateur ? '/compte' : '/connexion'} className={styles.pilule}>
            {utilisateur ? (prenomDe(utilisateur) || t('entete.monCompte')) : t('entete.seConnecter')}
          </Link>
        </nav>
      )}
    </header>
  );
}
