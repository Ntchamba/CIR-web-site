// BF-02, BF-03, BF-04 : réalisations, d'après les maquettes. Bandeau (fenêtre sur la scène du salon), avant / après,
// « La transformation en vidéo », onglets de type de chantier et grille des chantiers réels, témoignages (et formulaire
// de témoignage du client connecté, absent des maquettes).
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useEcranTelephone } from '@/app/preferences.js';
import EnteteSection from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';
import { useContenusAccueil } from '@/layout/contenus.js';
import { APRES_SALON } from '@/modules/accueil/composants/avantApres.js';

import Demos from './composants/Demos.jsx';
import FormulaireTemoignage from './composants/FormulaireTemoignage.jsx';
import Realisations from './composants/Realisations.jsx';
import Temoignages from './composants/Temoignages.jsx';
import styles from './Vitrine.module.css';

export default function VitrinePage() {
  const { t } = useTraduction();
  usePageMeta(t('vitrine.titre'), t('vitrine.description'));
  const telephone = useEcranTelephone();
  const { donnees } = useContenusAccueil();
  const affiche = donnees?.image_affiche;
  const video = donnees?.video_fond;
  return (
    <>
      <section className="m-bandeau">
        <div>
          <h1>{t('vitrine.titre')}</h1>
          <p>{t('vitrine.intro')}</p>
        </div>
      </section>

      {affiche?.url && (
        <div className="m-fond-flou" style={{ padding: telephone ? '0 0 40px' : '70px 0' }}>
          <div className="m-conteneur">
            <div className="m-grille-2 m-duo">
              <figure className="p3d">
                <img src={affiche.url} alt={t('accueil.realisations.avantAlt')} width="1280" height="720" decoding="async" />
                <figcaption>{t('accueil.realisations.avant')}</figcaption>
              </figure>
              <figure className="p3d">
                <img src={APRES_SALON} alt={t('accueil.realisations.apresAlt')} width="1280" height="720" decoding="async" />
                <figcaption>{t('accueil.realisations.apres')}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      )}

      {video && (
        <section id="transformation" className="m-section blanche" aria-labelledby="titre-transformation">
          <div className="m-conteneur">
            <EnteteSection id="titre-transformation" surtitre={t('vitrine.transformation.surtitre')} titre={t('vitrine.transformation.titre')} />
            <div className="m-video-demo p3d-grand">
              {/* Vidéo de la transformation (celle de l'accueil) : rien n'est téléchargé avant la lecture (preload metadata). */}
              <video controls preload="metadata" playsInline poster={affiche?.url || undefined} aria-label={t('vitrine.transformation.alt')}>
                <source src={video} />
              </video>
            </div>
          </div>
        </section>
      )}

      <Demos />
      <Realisations />

      <section id="temoignages" className="m-section blanche" aria-labelledby="titre-temoignages">
        <div className="m-conteneur">
          <EnteteSection id="titre-temoignages" surtitre={t('accueil.temoignages.surtitre')} titre={t('vitrine.temoignages.titre')} />
          <div className={styles.dispositionTemoignages}>
            <Temoignages />
            <FormulaireTemoignage />
          </div>
        </div>
      </section>
    </>
  );
}
