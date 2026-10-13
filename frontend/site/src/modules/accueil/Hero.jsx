// Haut de l'accueil : vidéo de fond (jouée une fois à chaque visite, puis arrêtée sur la maison),
// titre, accroche, bouton vers le catalogue, et la sphère de photos.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import Icone from '@/components/ui/Icone.jsx';

import styles from './Accueil.module.css';
import Sphere from './Sphere.jsx';

const petitEcran = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

export default function Hero({ contenu }) {
  const video = useRef(null);

  useEffect(() => {
    const v = video.current;
    if (!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = true;
    v.loop = false;
    try { v.currentTime = 0; } catch { /* vidéo pas encore prête */ }
    v.play().catch(() => {}); // lecture refusée (mode économie) : l'image de fond reste affichée
  }, []);

  const poster = `/media/accueil/video-poster-${petitEcran() ? 768 : 1280}.webp`;

  return (
    <section className={styles.hero}>
      <video ref={video} className={styles.video} muted playsInline preload="auto" poster={poster} aria-hidden="true">
        {contenu?.video ? <source src={contenu.video} /> : null}
        <source src="/media/accueil/fond.webm" type="video/webm" />
        <source src="/media/accueil/fond.mp4" type="video/mp4" />
      </video>
      <div className={styles.voileHero} aria-hidden="true" />
      <div className={styles.heroContenu}>
        <div className={styles.heroTexte}>
          <h1>{contenu?.titre || 'Révélation'}<span>.</span></h1>
          <p>{contenu?.accroche
            || "Là où naissent les sols durables : la résine époxy pour la maison, l'industrie et l'entreprise."}</p>
          <Link to="/catalogue" className={styles.boutonHero}>
            <span className={styles.rond}><Icone nom="fleche" taille={18} /></span>
            Voir le catalogue
          </Link>
        </div>
        <Sphere photos={contenu?.sphere} />
      </div>
    </section>
  );
}
