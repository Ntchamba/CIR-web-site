// Haut de l'accueil : vidéo de fond (ou affiche), titre, accroche, accès au catalogue, sphère de photos.
// Titre et accroche viennent des contenus de l'équipe ; textes par défaut traduits s'ils sont vides.
// Tant que les contenus n'ont pas répondu (`pret` faux), titre et accroche sont masqués mais gardent leur place :
// pas de texte par défaut remplacé un instant plus tard.
import { useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
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
  return (
    <section className={styles.entree} aria-labelledby="titre-accueil">
     <div className={styles.cadre}>
      <div className={`zoom-fenetres ${styles.fondHero} ${videoFinie ? styles.fondFini : ''}`} aria-hidden="true">
        <VideoFond video={contenu.video_fond} affiche={contenu.image_affiche} surFin={() => setVideoFinie(true)} />
        <div className={styles.voile} />
      </div>
      <div className={`conteneur hero-eloigne ${styles.heroContenu} ${sphere.length ? '' : styles.heroSeul}`}>
        <div className={styles.heroTexte}>
          <span className={styles.surtitreHero}>{t('accueil.hero.surtitre')}</span>
          <h1 id="titre-accueil" className={pret ? '' : styles.enAttente}>{contenu.titre || t('accueil.hero.titre')}</h1>
          <p className={pret ? '' : styles.enAttente}>{contenu.accroche || t('accueil.hero.accroche')}</p>
          <div className={styles.actionsHero}>
            <Bouton as={Link} to="/catalogue">
              {t('accueil.hero.catalogue')}
              <Icone nom="fleche" taille={18} />
            </Bouton>
            <Bouton as={Link} to="/realisations" variante="contour">{t('accueil.hero.realisations')}</Bouton>
          </div>
        </div>
        <Sphere photos={sphere} />
      </div>
      <a href="#salles" className={`hero-eloigne ${styles.decouvrir}`}>
        {t('accueil.hero.decouvrir')}
        <Icone nom="fleche" taille={16} />
      </a>
     </div>
    </section>
  );
}
