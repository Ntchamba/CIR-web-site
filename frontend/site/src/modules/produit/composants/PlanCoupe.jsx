// BF-06 : plan de coupe, les couches du revêtement de la surface (première) jusqu'au support.
// Le schéma est une liste ordonnée : les lecteurs d'écran la lisent couche par couche.
import { useTraduction } from '@/i18n/index.js';

import styles from '../Produit.module.css';

export default function PlanCoupe({ couches = [] }) {
  const { t } = useTraduction();
  if (!couches.length) return null;
  return (
    <section className={styles.coupe} aria-labelledby="titre-coupe">
      <h2 id="titre-coupe">{t('produit.coupe.titre')}</h2>
      <p className={styles.texteCoupe}>{t('produit.coupe.intro', { n: couches.length })}</p>
      <ol className={styles.couches}>
        {couches.map((c, i) => (
          <li key={`${c.nom}-${i}`} style={{ '--niveau': i }}>
            <span className={styles.nomCouche}>
              {c.nom}
              {i === 0 && <span className={styles.etiquetteSurface}>{t('produit.coupe.surface')}</span>}
            </span>
            {c.epaisseur && (
              <span className={styles.epaisseur}>
                <span aria-hidden="true">{c.epaisseur}</span>
                <span className="visuellement-cache">{t('produit.coupe.epaisseurDe', { valeur: c.epaisseur })}</span>
              </span>
            )}
          </li>
        ))}
        <li className={styles.support}>
          <span className={styles.nomCouche}>{t('produit.coupe.support')}</span>
        </li>
      </ol>
    </section>
  );
}
