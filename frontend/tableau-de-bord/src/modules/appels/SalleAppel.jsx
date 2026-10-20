// Salle d'appel en plein écran, côté équipe (modérateur). Le script Jitsi n'est chargé qu'ici, au moment de répondre.
// Libération propre de l'API Jitsi au démontage.
import { useEffect, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';

import { useTraduction } from '@/i18n/index.js';

import { chargerJitsi } from './jitsi.js';
import styles from './Appels.module.css';

export default function SalleAppel({ appel, jitsi, nomMembre, surFin }) {
  const { t } = useTraduction();
  const conteneur = useRef(null);
  const api = useRef(null);
  const raccrocher = useRef(null);
  const [etat, setEtat] = useState('chargement'); // chargement | connecte | erreur
  const [avertissement, setAvertissement] = useState('');
  const fin = useRef(surFin);
  fin.current = surFin;

  useEffect(() => raccrocher.current?.focus(), []);

  useEffect(() => {
    let annule = false;
    chargerJitsi(jitsi?.domaine, jitsi?.app_id)
      .then((Jitsi) => {
        if (annule || !conteneur.current) return;
        const audio = appel.type === 'audio';
        const instance = new Jitsi(jitsi.domaine, {
          roomName: `${jitsi.app_id}/${jitsi.salle}`,
          jwt: jitsi.jeton,
          parentNode: conteneur.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName: nomMembre || 'CIR' },
          configOverwrite: {
            prejoinPageEnabled: false, startWithVideoMuted: audio, startAudioOnly: audio, disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'chat', 'tileview', 'fullscreen'],
          },
        });
        api.current = instance;
        instance.addListener?.('videoConferenceJoined', () => setEtat('connecte'));
        instance.addListener?.('videoConferenceLeft', () => fin.current());
        instance.addListener?.('readyToClose', () => fin.current());
        instance.addListener?.('cameraError', () => setAvertissement(t('appels.salle.erreurCamera')));
        instance.addListener?.('micError', () => setAvertissement(t('appels.salle.erreurMicro')));
        setEtat('connecte');
      })
      .catch(() => { if (!annule) setEtat('erreur'); });
    return () => {
      annule = true;
      try { api.current?.dispose?.(); } catch { /* déjà libérée */ }
      api.current = null;
    };
    // La salle est créée une fois par appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appel.id]);

  function quitter() {
    try { api.current?.executeCommand?.('hangup'); } catch { /* ignoré */ }
    surFin();
  }

  const nom = appel.client?.nom_complet || '';
  return (
    <div className={styles.salle} role="dialog" aria-modal="true" aria-label={t('appels.salle.titre', { nom })}>
      <div className={styles.enteteSalle}>
        <p><strong>{t('appels.salle.titre', { nom })}</strong>{appel.reference ? ` · ${appel.reference}` : ''}</p>
        <Bouton ref={raccrocher} variante="sombre" onClick={quitter}>{t('appels.salle.raccrocher')}</Bouton>
      </div>
      {avertissement && <p className={styles.avertissementSalle} role="alert">{avertissement}</p>}
      {etat === 'erreur' && <p className={styles.avertissementSalle} role="alert">{t('appels.salle.erreurChargement')}</p>}
      {etat === 'chargement' && <Chargement texte={t('appels.salle.chargement')} />}
      <div ref={conteneur} className={styles.zoneVideo} />
    </div>
  );
}
