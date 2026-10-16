// Galerie de la fiche produit : grande image et vignettes (boutons accessibles au clavier).
// Rendue avec key={slug} : l'image choisie repart de la première à chaque produit.
import { useState } from 'react';

import ImageMedia from '@/composants/ImageMedia.jsx';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Produit.module.css';

export default function Galerie({ images = [], nom, reference }) {
  const { t } = useTraduction();
  const [index, setIndex] = useState(0);

  if (!images.length) {
    return (
      <div className={`${styles.galerie} ${styles.sansImage}`}>
        <span aria-hidden="true">{reference || nom}</span>
        <p>{t('produit.galerie.sansImage')}</p>
      </div>
    );
  }
  const courante = images[Math.min(index, images.length - 1)];
  return (
    <div className={styles.galerie}>
      <div className={styles.grandeImage}>
        <ImageMedia image={courante} alt={courante.alt || nom} largeur={1280} hauteur={960} prioritaire />
      </div>
      {images.length > 1 && (
        <ul className={styles.vignettes} aria-label={t('produit.galerie.vignettes')}>
          {images.map((image, i) => (
            <li key={image.url}>
              <button type="button" onClick={() => setIndex(i)} aria-pressed={i === index}
                aria-label={t('produit.galerie.voirImage', { n: i + 1, total: images.length })}>
                <ImageMedia image={image} alt="" largeur={120} hauteur={90} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
