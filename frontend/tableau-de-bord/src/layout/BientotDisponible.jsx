// Page d'un module pas encore livré : titre et mention « Bientôt disponible ».
// `module` : clé des textes traduits (modules.<module>.libelle et modules.<module>.texte).
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import styles from './Pages.module.css';

export default function BientotDisponible({ module }) {
  const { t } = useTraduction();
  const titre = t(`modules.${module}.libelle`);
  usePageMeta(titre);
  return (
    <div className={styles.page}>
      <h1 className="titre-page">{titre}</h1>
      <div className={`carte ${styles.bientot}`}>
        <span className={styles.pastille}>{t('bientot.pastille')}</span>
        <EtatVide titre={t('bientot.titre')}
          action={<Bouton as={Link} to="/" variante="contour">{t('bientot.retour')}</Bouton>}>
          {t(`modules.${module}.texte`)}
        </EtatVide>
      </div>
    </div>
  );
}
