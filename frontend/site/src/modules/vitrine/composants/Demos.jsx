// BF-03 : démonstrations vidéo. Rien n'est téléchargé avant le clic sur « Lire » (vidéo ou lecteur intégré).
import { useState } from 'react';

import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import EnteteSection from '@/composants/EnteteSection.jsx';
import ImageMedia from '@/composants/ImageMedia.jsx';
import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import { adresseIntegration, lienHttps } from '../regles.js';
import { useDemos } from '../useVitrine.js';
import styles from '../Vitrine.module.css';

function Lecteur({ demo }) {
  const { t } = useTraduction();
  const [lecture, setLecture] = useState(false);
  const integration = demo.integration ? adresseIntegration(demo.integration) : null;
  const lisible = Boolean(demo.video || integration);
  const lien = lienHttps(demo.lien);

  if (lecture && demo.video) {
    return (
      // Démonstrations de pose, sans parole : pas de piste de sous-titres.
      <video className={styles.media} src={demo.video} poster={demo.miniature?.url} controls autoPlay playsInline
        preload="auto" aria-label={demo.titre} />
    );
  }
  if (lecture && integration) {
    return (
      <iframe className={styles.media} src={integration} title={t('vitrine.demos.lecteur', { titre: demo.titre })}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" />
    );
  }

  const apercu = (
    <>
      {demo.miniature?.url
        ? <ImageMedia image={demo.miniature} alt="" largeur={960} hauteur={540} />
        : <span className={styles.sansMiniature} aria-hidden="true" />}
      <span className={styles.lire} aria-hidden="true"><Icone nom="fleche" taille={26} /></span>
      {demo.duree && <span className={styles.duree} aria-hidden="true">{demo.duree}</span>}
    </>
  );

  if (lisible) {
    return (
      <button type="button" className={styles.apercu} onClick={() => setLecture(true)}
        aria-label={demo.duree
          ? t('vitrine.demos.lireDuree', { titre: demo.titre, duree: demo.duree })
          : t('vitrine.demos.lire', { titre: demo.titre })}>
        {apercu}
      </button>
    );
  }
  if (lien) {
    return (
      <a href={lien} className={styles.apercu} target="_blank" rel="noopener noreferrer"
        aria-label={t('vitrine.demos.ouvrir', { titre: demo.titre })}>
        {apercu}
      </a>
    );
  }
  return <div className={styles.apercu}>{apercu}</div>;
}

export default function Demos() {
  const { t } = useTraduction();
  const liste = useDemos();
  // Aucune démonstration publiée : la section n'apparaît pas (la vidéo de la transformation est montrée plus haut).
  if (!liste.chargement && !liste.erreur && !liste.elements.length) return null;
  return (
    <section id="demos" className="m-section blanche" aria-labelledby="titre-demos">
     <div className="m-conteneur">
      <EnteteSection id="titre-demos" surtitre={t('vitrine.transformation.surtitre')} titre={t('vitrine.demos.titre')} />
      {liste.chargement && !liste.elements.length && <Chargement />}
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {!liste.chargement && !liste.erreur && !liste.elements.length && (
        <EtatVide titre={t('vitrine.demos.vide.titre')} niveau={3}>{t('vitrine.demos.vide.texte')}</EtatVide>
      )}
      {liste.elements.length > 0 && (
        <ul className={styles.grilleDemos}>
          {liste.elements.map((d) => (
            <li key={d.id}>
              <figure className={styles.demo}>
                <div className={styles.cadreMedia}><Lecteur demo={d} /></div>
                <figcaption>
                  <strong>{d.titre}</strong>
                  {d.description && <p>{d.description}</p>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
      <VoirPlus liste={liste} />
     </div>
    </section>
  );
}
