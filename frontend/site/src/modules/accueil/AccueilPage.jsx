// BF-15, O2 : accueil. Bandeaux, haut de page (vidéo, titre, sphère), usages, produits à la une,
// dernières actualités, aperçu des réalisations, partenaire Jiuye.
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import SectionActualites from '@/modules/actualites/composants/SectionActualites.jsx';
import SectionContact from '@/modules/contact/composants/SectionContact.jsx';

import ApercuRealisations from './composants/ApercuRealisations.jsx';
import Bandeaux from './composants/Bandeaux.jsx';
import Hero from './composants/Hero.jsx';
import Partenaire from './composants/Partenaire.jsx';
import ProduitsALaUne from './composants/ProduitsALaUne.jsx';
import Usages from './composants/Usages.jsx';
import useAccueil from './useAccueil.js';
import styles from './Accueil.module.css';

export default function AccueilPage() {
  const { t } = useTraduction();
  usePageMeta('', t('accueil.description'));
  const { contenu, contenuPret, aLaUne, realisations } = useAccueil();
  return (
    <>
      <Bandeaux bandeaux={contenu.bandeaux} />
      <Hero contenu={contenu} pret={contenuPret} />
      {/* Une suite de « salles » en profondeur (décision 11), dans l'ordre de la maquette : sélection, réalisations,
          puis usages, actualités, partenaire et, en bas, le contact. */}
      <div id="salles" className={styles.salles}>
        <ProduitsALaUne produits={aLaUne} />
        <ApercuRealisations realisations={realisations} />
        <Usages />
        <SectionActualites />
        <Partenaire texte={contenu.texte_partenaire} />
        <SectionContact salle />
      </div>
    </>
  );
}
