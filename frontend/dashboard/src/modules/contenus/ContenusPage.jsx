// BF-15 : contenus du site — accueil (textes, vidéo, coordonnées), sphère, réalisations, démos,
// témoignages à valider, nouveautés.
import Entete from '@/components/layout/Entete.jsx';

import SectionAccueil from './SectionAccueil.jsx';
import SectionDemos from './SectionDemos.jsx';
import SectionNouveautes from './SectionNouveautes.jsx';
import SectionRealisations from './SectionRealisations.jsx';
import SectionSphere from './SectionSphere.jsx';
import SectionTemoignages from './SectionTemoignages.jsx';

export default function ContenusPage() {
  return (
    <>
      <Entete titre="Contenus du site"
        intro="Vidéo et sphère de l'accueil, réalisations, démonstrations, témoignages, nouveautés et coordonnées." />
      <div className="coque-contenu">
        <div className="rangee">
          <SectionAccueil />
          <SectionSphere />
        </div>
        <SectionRealisations />
        <SectionDemos />
        <div className="rangee">
          <SectionTemoignages />
          <SectionNouveautes />
        </div>
      </div>
    </>
  );
}
