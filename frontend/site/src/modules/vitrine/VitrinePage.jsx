// BF-02, BF-03, BF-04 : page « Réalisations » : chantiers (avant / après), démonstrations vidéo, témoignages.
import usePageMeta from '@partage/utils/usePageMeta.js';

import BandeauPhoto from '@/composants/BandeauPhoto.jsx';
import { useTraduction } from '@/i18n/index.js';

import Demos from './composants/Demos.jsx';
import FormulaireTemoignage from './composants/FormulaireTemoignage.jsx';
import Realisations from './composants/Realisations.jsx';
import Temoignages from './composants/Temoignages.jsx';
import styles from './Vitrine.module.css';

export default function VitrinePage() {
  const { t } = useTraduction();
  usePageMeta(t('vitrine.titre'), t('vitrine.description'));
  return (
    <>
    <BandeauPhoto titre={t('vitrine.titre')} intro={t('vitrine.intro')} />
    <div className="verre">
    <div className="conteneur section">
      <nav aria-label={t('vitrine.sommaire')} className={styles.sommaire}>
        <a href="#chantiers">{t('vitrine.realisations.titre')}</a>
        <a href="#demos">{t('vitrine.demos.titre')}</a>
        <a href="#temoignages">{t('vitrine.temoignages.titre')}</a>
      </nav>

      <Realisations />
      <Demos />

      <section id="temoignages" className={`${styles.section} p3d-grand`} aria-labelledby="titre-temoignages">
        <h2 id="titre-temoignages" className={styles.titreSection}>{t('vitrine.temoignages.titre')}</h2>
        <div className={styles.dispositionTemoignages}>
          <Temoignages />
          <FormulaireTemoignage />
        </div>
      </section>
    </div>
    </div>
    </>
  );
}
