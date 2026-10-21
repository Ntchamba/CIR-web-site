// Haut de l'accueil (maquettes) : vidéo de fond, « Révélation. », accroche, « Voir le catalogue », sphère de photos,
// « Découvrir ↓ ». Titre et accroche viennent des contenus de l'équipe ; textes par défaut traduits s'ils sont vides.
// Tant que les contenus n'ont pas répondu (`pret` faux), titre et accroche sont masqués mais gardent leur place.
import { useState } from 'react';
import { Link } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Accueil.module.css';
import Sphere from './Sphere.jsx';
import VideoFond from './VideoFond.jsx';

export default function Hero({ contenu = {}, pret = true }) {
  const { t } = useTraduction();
  const sphere = contenu.sphere || [];
  // La vidéo s'arrête sur la dernière image : c'est celle de la scène (fond de toutes les pages). Une fois finie,
  // la vidéo s'efface et laisse voir la scène, identique : aucun saut, et c'est la scène qui zoome ensuite.
  const [videoFinie, setVideoFinie] = useState(false);
  const titre = contenu.titre || t('accueil.hero.titre');
  return (
    <section className={styles.entree} aria-labelledby="titre-accueil">
      <div className={styles.cadre}>
        <div className={`zoom-fenetres ${styles.fondHero} ${videoFinie ? styles.fondFini : ''}`} aria-hidden="true">
          <VideoFond video={contenu.video_fond} affiche={contenu.image_affiche} surFin={() => setVideoFinie(true)} />
          <div className={styles.voile} />
        </div>
        <div className={`hero-eloigne ${styles.contenu} ${sphere.length ? '' : styles.seul}`}>
          <div>
            <h1 id="titre-accueil" className={pret ? '' : styles.enAttente}>
              {titre}{!contenu.titre && <i>.</i>}
            </h1>
            <p className={pret ? '' : styles.enAttente}>{contenu.accroche || t('accueil.hero.accroche')}</p>
            <Link to="/catalogue" className="m-btn-rond">
              <span><Icone nom="fleche" taille={18} epaisseur={2} /></span>
              {t('accueil.hero.catalogue')}
            </Link>
          </div>
          <Sphere photos={sphere} />
        </div>
        <a href="#salles" className={`hero-eloigne ${styles.decouvrir}`}>{t('accueil.hero.decouvrir')} ↓</a>
      </div>
    </section>
  );
}
