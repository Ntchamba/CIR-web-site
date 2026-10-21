// Aperçu des dernières réalisations du CIR. Rien n'est affiché tant qu'aucun chantier n'est publié.
import EnteteSection from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';
import CarteRealisation from '@/modules/vitrine/composants/CarteRealisation.jsx';

import styles from '../Accueil.module.css';

export default function ApercuRealisations({ realisations = [] }) {
  const { t } = useTraduction();
  if (!realisations.length) return null;
  return (
    <section className="salle" aria-labelledby="titre-apercu-realisations">
      <div className="conteneur">
        <EnteteSection id="titre-apercu-realisations" surtitre={t('accueil.realisations.surtitre')}
          titre={t('accueil.realisations.titre')} lien="/realisations" texteLien={t('accueil.realisations.toutes')} />
        <ul className={styles.grille}>
          {realisations.map((r) => <li key={r.id} className="p3d"><CarteRealisation realisation={r} resume /></li>)}
        </ul>
      </div>
    </section>
  );
}
