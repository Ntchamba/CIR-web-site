// Cloche de l'en-tête : pastille du nombre de notifications non lues et menu des dernières notifications.
// Les nouvelles notifications arrivent en direct (annoncées aux lecteurs d'écran).
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { resultats } from '@partage/api/client.js';
import Chargement from '@partage/ui/Chargement.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { depuis } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import { useDirect, useEvenementsDirect } from '../FondDirect.jsx';
import * as notifications from '../api.js';
import { cheminSur } from '../lien.js';
import { useActionsNotifications } from '../useNotifications.js';
import styles from '../Notifications.module.css';

const TAILLE_MENU = 8;

export default function CentreNotifications() {
  const { t } = useTraduction();
  const naviguer = useNavigate();
  const { nonLuesNotifications } = useDirect();
  const { marquerLue, toutMarquerLu } = useActionsNotifications();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState({ elements: [], chargement: false, erreur: null });
  const [annonce, setAnnonce] = useState('');
  const racine = useRef(null);
  const bouton = useRef(null);
  const idMenu = useId();

  const charger = useCallback(async () => {
    setListe((l) => ({ ...l, chargement: true, erreur: null }));
    try {
      const donnees = await notifications.lister({});
      setListe({ elements: resultats(donnees).slice(0, TAILLE_MENU), chargement: false, erreur: null });
    } catch (erreur) {
      setListe((l) => ({ ...l, chargement: false, erreur }));
    }
  }, []);

  useEffect(() => {
    if (ouvert) charger();
  }, [ouvert, charger]);

  // Nouvelle notification poussée en direct : annoncée, et ajoutée en tête du menu s'il est ouvert.
  useEvenementsDirect((trame) => {
    if (trame.type !== 'notification' || !trame.notification) return;
    const n = trame.notification;
    setAnnonce(`${n.titre || ''} ${n.texte || ''}`.trim());
    setListe((l) => (l.elements.some((e) => e.id === n.id)
      ? l
      : { ...l, elements: [n, ...l.elements].slice(0, TAILLE_MENU) }));
  });

  // Fermeture : Échap (le focus revient au bouton) et clic en dehors.
  useEffect(() => {
    if (!ouvert) return undefined;
    const surTouche = (e) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    const surClic = (e) => {
      if (racine.current && !racine.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [ouvert]);

  async function ouvrir(notification) {
    setOuvert(false);
    setListe((l) => ({ ...l, elements: l.elements.map((e) => (e.id === notification.id ? { ...e, lue: true } : e)) }));
    try {
      await marquerLue(notification);
    } catch {
      /* la lecture sera remarquée plus tard ; la navigation continue */
    }
    naviguer(cheminSur(notification.lien));
  }

  async function toutLire() {
    try {
      await toutMarquerLu();
      setListe((l) => ({ ...l, elements: l.elements.map((e) => ({ ...e, lue: true })) }));
    } catch (erreur) {
      setListe((l) => ({ ...l, erreur }));
    }
  }

  const etiquette = nonLuesNotifications > 0
    ? t('notifications.centre.ouvrirNonLues', { n: nonLuesNotifications })
    : t('notifications.centre.ouvrir');

  return (
    <div className={styles.centre} ref={racine}>
      <button type="button" ref={bouton} className={styles.cloche} aria-label={etiquette}
        aria-expanded={ouvert} aria-controls={ouvert ? idMenu : undefined} aria-haspopup="true"
        onClick={() => setOuvert((o) => !o)}>
        <Icone nom="cloche" />
        {nonLuesNotifications > 0 && (
          <span className={styles.pastille} aria-hidden="true">{nonLuesNotifications > 99 ? '99+' : nonLuesNotifications}</span>
        )}
      </button>
      <div className="visuellement-cache" role="status" aria-live="polite">{annonce}</div>
      {ouvert && (
        <section id={idMenu} className={styles.menu} aria-label={t('notifications.centre.titre')}>
          <div className={styles.menuHaut}>
            <h2>{t('notifications.centre.titre')}</h2>
            <button type="button" className={styles.lienBouton} onClick={toutLire} disabled={nonLuesNotifications === 0}>
              {t('notifications.toutLire')}
            </button>
          </div>
          {liste.chargement && liste.elements.length === 0 && <Chargement />}
          <MessageErreur erreur={liste.erreur} reessayer={charger} />
          {!liste.chargement && !liste.erreur && liste.elements.length === 0 && (
            <p className={styles.meta}>{t('notifications.vide')}</p>
          )}
          {liste.elements.length > 0 && (
            <ul className={styles.listeMenu}>
              {liste.elements.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`${styles.element} ${n.lue ? '' : styles.nonLue}`} onClick={() => ouvrir(n)}>
                    <span className={styles.elementTitre}>
                      {!n.lue && <span className="visuellement-cache">{t('notifications.nonLue')} : </span>}
                      {n.titre}
                    </span>
                    {n.texte && <span className={styles.elementTexte}>{n.texte}</span>}
                    <time className={styles.meta} dateTime={n.cree_le}>{depuis(n.cree_le)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className={styles.toutVoir} onClick={() => setOuvert(false)}>
            {t('notifications.centre.toutVoir')}
          </Link>
        </section>
      )}
    </div>
  );
}
