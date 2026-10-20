// Cloche de l'en-tête : pastille du nombre de notifications non lues (en direct) et menu des dernières notifications.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { resultats } from '@/app/api.js';
import { useTraduction } from '@/i18n/index.js';
import { useDirect } from '@/layout/direct.js';
import IconeMenu from '@/layout/IconeMenu.jsx';

import { listerNotifications, marquerLue, toutMarquerLu } from '../api.js';
import ElementNotification from './ElementNotification.jsx';
import styles from '../Notifications.module.css';

const NOMBRE_RECENTES = 6;

export default function CentreNotifications() {
  const { t } = useTraduction();
  const direct = useDirect();
  const idPanneau = useId();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState(null);
  const racine = useRef(null);
  const bouton = useRef(null);
  const n = direct.compteurs.notifications;

  const charger = useCallback(() => {
    setErreur(null);
    listerNotifications({ page: 1 })
      .then((r) => setListe(resultats(r).slice(0, NOMBRE_RECENTES)))
      .catch((e) => setErreur(e));
  }, []);

  useEffect(() => { if (ouvert) charger(); }, [ouvert, charger]);
  useEffect(() => {
    if (!ouvert) return undefined;
    return direct.abonner((trame) => { if (trame.type === 'notification') charger(); });
  }, [ouvert, direct, charger]);

  // Fermeture : Échap (le focus revient au bouton) et clic en dehors.
  useEffect(() => {
    if (!ouvert) return undefined;
    const surTouche = (e) => { if (e.key === 'Escape') { setOuvert(false); bouton.current?.focus(); } };
    const surClic = (e) => { if (racine.current && !racine.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [ouvert]);

  async function lire(notification) {
    if (notification.lue) return;
    setListe((l) => l?.map((x) => (x.id === notification.id ? { ...x, lue: true } : x)));
    try { await marquerLue(notification.id); } catch { /* le compteur se recale à la prochaine lecture */ }
    direct.rafraichir();
  }
  async function toutLu() {
    try { await toutMarquerLu(); } catch (e) { setErreur(e); return; }
    setListe((l) => l?.map((x) => ({ ...x, lue: true })));
    direct.rafraichir();
  }

  return (
    <div className={styles.centre} ref={racine}>
      <button type="button" ref={bouton} className={styles.cloche} aria-expanded={ouvert} aria-controls={idPanneau}
        aria-haspopup="true" onClick={() => setOuvert((o) => !o)}
        aria-label={n > 0 ? t('notifications.centre.ouvrirNonLues', { n }) : t('notifications.centre.ouvrir')}>
        <IconeMenu nom="notifications" taille={22} />
        {n > 0 && <span className={styles.pastilleCloche} aria-hidden="true">{n > 99 ? '99+' : n}</span>}
      </button>
      {ouvert && (
        <div id={idPanneau} className={styles.panneauCentre} role="region" aria-label={t('notifications.centre.titre')}>
          <div className={styles.enteteCentre}>
            <strong>{t('notifications.centre.titre')}</strong>
            <button type="button" className={styles.lienBouton} onClick={toutLu} disabled={!liste?.some((x) => !x.lue)}>
              {t('notifications.toutLu')}
            </button>
          </div>
          {erreur ? <MessageErreur erreur={erreur} reessayer={charger} />
            : !liste ? <Chargement texte={t('notifications.chargement')} />
              : liste.length === 0 ? <p className={styles.videCentre}>{t('notifications.aucune')}</p>
                : (
                  <ul className={styles.listeCentre}>
                    {liste.map((x) => (
                      <ElementNotification key={x.id} notification={x} surLecture={lire} surNavigation={() => setOuvert(false)} />
                    ))}
                  </ul>
                )}
          <Link to="/notifications" className={styles.toutVoir} onClick={() => setOuvert(false)}>
            {t('notifications.centre.toutVoir')}
          </Link>
        </div>
      )}
    </div>
  );
}
