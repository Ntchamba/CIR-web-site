// Partenaire fabricant Jiuye (nom propre, jamais traduit). Texte de l'équipe, sinon texte par défaut traduit.
import { Link } from 'react-router';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Accueil.module.css';

export default function Partenaire({ texte }) {
  const { t } = useTraduction();
  return (
    <section className={`salle salle-nuit ${styles.partenaire}`} aria-labelledby="titre-partenaire">
      <div className={`conteneur p3d ${styles.partenaireContenu}`}>
        <img src="/media/marque/logo-jiuye.webp" alt="Jiuye" width="96" height="150" loading="lazy" decoding="async" />
        <div>
          <span className={styles.surtitreClair}>{t('accueil.partenaire.surtitre')}</span>
          <h2 id="titre-partenaire">{t('accueil.partenaire.titre')}</h2>
          <p>{texte || t('accueil.partenaire.texte')}</p>
          <Link to="/catalogue" className={styles.lienClair}>{t('accueil.partenaire.lien')}</Link>
        </div>
      </div>
    </section>
  );
}
