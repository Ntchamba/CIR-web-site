// Page d'un module pas encore livré : titre et mention « Bientôt disponible ».
// `page` : clé des textes traduits (pages.<page>.titre et pages.<page>.texte).
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import { COORDONNEES } from './coordonnees.js';
import styles from './BientotDisponible.module.css';

export default function BientotDisponible({ page }) {
  const { t } = useTraduction();
  const titre = t(`pages.${page}.titre`);
  const texte = t(`pages.${page}.texte`);
  usePageMeta(titre);
  return (
    <div className="conteneur section">
      <h1 className="titre-page">{titre}</h1>
      <div className={styles.carte}>
        <span className={styles.pastille}>{t('bientot.pastille')}</span>
        <EtatVide titre={t('bientot.titre')}
          action={<Bouton as="a" href={COORDONNEES.lienTelephone} variante="contour">{t('bientot.appeler')}</Bouton>}>
          {t('bientot.attente', { texte })}
        </EtatVide>
        <Link to="/" className={styles.retour}>{t('bientot.retour')}</Link>
      </div>
    </div>
  );
}
