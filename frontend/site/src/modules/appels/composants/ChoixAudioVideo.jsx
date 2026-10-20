// Choix de l'appel : audio ou vidéo, avec l'avertissement sur le micro et la caméra.
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Appels.module.css';

export default function ChoixAudioVideo({ onChoisir, onFermer, envoi = false, erreur = null }) {
  const { t } = useTraduction();
  const id = useId();
  const premier = useRef(null);

  useEffect(() => {
    premier.current?.focus();
    const surTouche = (e) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  return (
    <div className={styles.voile} onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={styles.dialogue} role="dialog" aria-modal="true" aria-labelledby={`${id}-titre`} aria-describedby={`${id}-texte`}>
        <h2 id={`${id}-titre`}>{t('appels.choix.titre')}</h2>
        <p id={`${id}-texte`} className={styles.avertissement}>{t('appels.choix.avertissement')}</p>
        <div className={styles.choix}>
          <button type="button" ref={premier} className={styles.choixBouton} disabled={envoi} onClick={() => onChoisir('audio')}>
            <Icone nom="micro" taille={28} />
            <strong>{t('appels.choix.audio')}</strong>
            <span>{t('appels.choix.audioAide')}</span>
          </button>
          <button type="button" className={styles.choixBouton} disabled={envoi} onClick={() => onChoisir('video')}>
            <Icone nom="video" taille={28} />
            <strong>{t('appels.choix.video')}</strong>
            <span>{t('appels.choix.videoAide')}</span>
          </button>
        </div>
        <div role="alert">
          {erreur && (
            <div className={styles.erreur}>
              <p>{erreur.message}</p>
              {erreur.alternatives && (
                <p className={styles.alternatives}>
                  <Link to="/messages" onClick={onFermer}>{t('appels.ecrireMessage')}</Link>
                  <Link to="/contact" onClick={onFermer}>{t('appels.demanderRappel')}</Link>
                </p>
              )}
            </div>
          )}
        </div>
        <Bouton variante="texte" onClick={onFermer}>{t('appels.choix.annuler')}</Bouton>
      </div>
    </div>
  );
}
