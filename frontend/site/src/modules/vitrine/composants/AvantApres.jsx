// BF-02 : comparaison avant / après d'un chantier. Le curseur est un vrai <input type="range"> :
// flèches du clavier, glisser au doigt, valeur annoncée par les lecteurs d'écran.
import { useState } from 'react';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Vitrine.module.css';

export default function AvantApres({ avant, apres, titre }) {
  const { t } = useTraduction();
  const [position, setPosition] = useState(50);
  return (
    <div className={styles.avantApres} style={{ '--position': `${position}%` }}>
      <img src={apres.url} alt={apres.alt || t('vitrine.avantApres.altApres', { titre })}
        width="1280" height="960" loading="lazy" decoding="async" />
      <div className={styles.calqueAvant}>
        <img src={avant.url} alt={avant.alt || t('vitrine.avantApres.altAvant', { titre })}
          width="1280" height="960" loading="lazy" decoding="async" />
      </div>
      <span className={`${styles.etiquetteImage} ${styles.etiquetteAvant}`} aria-hidden="true">{t('vitrine.avantApres.avant')}</span>
      <span className={`${styles.etiquetteImage} ${styles.etiquetteApres}`} aria-hidden="true">{t('vitrine.avantApres.apres')}</span>
      <span className={styles.poignee} aria-hidden="true" />
      <input type="range" min="0" max="100" step="1" value={position} className={styles.curseur}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label={t('vitrine.avantApres.curseur', { titre })}
        aria-valuetext={t('vitrine.avantApres.valeur', { avant: position, apres: 100 - position })} />
    </div>
  );
}
