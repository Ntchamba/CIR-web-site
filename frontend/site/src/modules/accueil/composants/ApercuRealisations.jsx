// « Avant, après / Nos réalisations » (maquettes) : l'avant (béton brut, première image de la vidéo) et l'après (le salon,
// dernière image) puis les derniers chantiers réels (nom, type, ville). Aucune réalisation inventée : sans chantier
// publié, seule la paire avant / après est montrée ; sans affiche de vidéo, elle est masquée.
import { Link } from 'react-router';

import EnteteSection, { LienSection } from '@/composants/EnteteSection.jsx';
import ImageMedia from '@/composants/ImageMedia.jsx';
import { useTraduction } from '@/i18n/index.js';
import { estUsage } from '@/modules/catalogue/usages.js';

import { APRES_SALON } from './avantApres.js';

export default function ApercuRealisations({ realisations = [], affiche = null }) {
  const { t } = useTraduction();
  const avantApres = Boolean(affiche?.url);
  if (!avantApres && !realisations.length) return null;
  return (
    <section className="m-section claire" aria-labelledby="titre-apercu-realisations">
      <div className="m-conteneur">
        <EnteteSection id="titre-apercu-realisations" surtitre={t('accueil.realisations.surtitre')}
          titre={t('accueil.realisations.titre')} lien="/realisations" texteLien={t('accueil.realisations.toutes')} />
        {avantApres && (
          <div className="m-grille-2 m-duo">
            <figure className="p3d">
              <img src={affiche.url} alt={t('accueil.realisations.avantAlt')} width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>{t('accueil.realisations.avant')}</figcaption>
            </figure>
            <figure className="p3d">
              <img src={APRES_SALON} alt={t('accueil.realisations.apresAlt')} width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>{t('accueil.realisations.apres')}</figcaption>
            </figure>
          </div>
        )}
        {realisations.length > 0 && (
          <ul className="m-grille-3" style={avantApres ? { marginTop: 34 } : undefined}>
            {realisations.map((r) => (
              <li key={r.id} className="p3d">
                <Link to="/realisations" className="m-carte-chantier">
                  <div className="img"><ImageMedia image={r.image_apres} alt="" largeur={800} hauteur={600} /></div>
                  <h3>{r.titre}</h3>
                  <p>{[estUsage(r.type_chantier) ? t(`usages.${r.type_chantier}`) : null, r.ville].filter(Boolean).join(' · ')}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LienSection lien="/realisations" texte={t('accueil.realisations.toutes')} />
      </div>
    </section>
  );
}
