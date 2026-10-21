// BF-15, O2 : accueil des maquettes. Haut de page (vidéo, titre, sphère), sélection, réalisations, [actualités],
// témoignages, contact ; le pied de page vient du gabarit. Les sections qui n'ont pas de données réelles sont masquées.
import { Link } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import SectionActualites from '@/modules/actualites/composants/SectionActualites.jsx';
import SectionContact from '@/modules/contact/composants/SectionContact.jsx';
import { estUsage } from '@/modules/catalogue/usages.js';

import ApercuRealisations from './composants/ApercuRealisations.jsx';
import Bandeaux from './composants/Bandeaux.jsx';
import Hero from './composants/Hero.jsx';
import ProduitsALaUne from './composants/ProduitsALaUne.jsx';
import Temoignages from './composants/Temoignages.jsx';
import useAccueil from './useAccueil.js';
import styles from './Accueil.module.css';

export default function AccueilPage() {
  const { t } = useTraduction();
  usePageMeta('', t('accueil.description'));
  const { contenu, contenuPret, aLaUne, realisations } = useAccueil();
  // Téléphone : « Réalisations », deux cartes sous le haut de page (les deux premiers chantiers réels).
  const cartesTel = realisations.filter((r) => r.image_apres?.url).slice(0, 2);
  return (
    <>
      <Hero contenu={contenu} pret={contenuPret} />
      {cartesTel.length > 0 && (
        <section className={styles.realisationsTel} aria-label={t('accueil.realisations.titre')}>
          <strong>{t('accueil.realisations.apercuTel')}</strong>
          <ul>
            {cartesTel.map((r) => (
              <li key={r.id}>
                <Link to="/realisations">
                  <img src={r.image_apres.url} alt={r.image_apres.alt || r.titre} loading="lazy" decoding="async" />
                  {estUsage(r.type_chantier) && <span>{t(`usages.${r.type_chantier}`)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Bandeaux bandeaux={contenu.bandeaux} />
      <ProduitsALaUne produits={aLaUne} />
      <ApercuRealisations realisations={realisations} affiche={contenu.image_affiche} />
      <SectionActualites />
      <Temoignages />
      <SectionContact salle />
    </>
  );
}
