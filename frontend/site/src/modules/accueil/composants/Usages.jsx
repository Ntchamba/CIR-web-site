// Les quatre usages des revêtements : chaque carte ouvre le catalogue filtré.
import { Link } from 'react-router';

import EnteteSection from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';
import { USAGES } from '@/modules/catalogue/usages.js';

import styles from '../Accueil.module.css';

export default function Usages() {
  const { t } = useTraduction();
  return (
    <section className="salle" aria-labelledby="titre-usages">
      <div className="conteneur">
        <EnteteSection id="titre-usages" surtitre={t('accueil.usages.surtitre')} titre={t('accueil.usages.titre')} />
        <ul className={styles.usages}>
          {USAGES.map((u) => (
            <li key={u} className="p3d">
              <Link to={`/catalogue?usage=${u}`} className={styles.usage}>
                <strong>{t(`usages.${u}`)}</strong>
                <span>{t(`accueil.usages.textes.${u}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
