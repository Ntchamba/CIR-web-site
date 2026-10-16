// Vidéo de fond de l'accueil : jouée une fois, sans son, décorative. Image seule (affiche) si le visiteur
// préfère moins d'animations ou si son navigateur est en mode « économie de données ».
import { useEffect, useRef } from 'react';

import { economieDonnees, useMouvementReduit } from '@/app/preferences.js';

import styles from '../Accueil.module.css';

export default function VideoFond({ video, affiche }) {
  const reduit = useMouvementReduit();
  const jouer = Boolean(video) && !reduit && !economieDonnees();
  const ref = useRef(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // React ne pose pas toujours l'attribut muted : sans lui, la lecture automatique est refusée
    try {
      v.play?.()?.catch?.(() => {}); // lecture refusée : l'affiche reste visible
    } catch {
      /* navigateur sans lecture vidéo */
    }
  }, [jouer, video]);

  if (jouer) {
    return (
      <video ref={ref} className={styles.fond} src={video} poster={affiche?.url || undefined}
        autoPlay muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} data-testid="video-fond" />
    );
  }
  if (affiche?.url) {
    return (
      <img className={styles.fond} src={affiche.url} alt="" width="1600" height="900" decoding="async"
        fetchPriority="high" data-testid="affiche-fond" />
    );
  }
  return null;
}
