// Page 404.
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

export default function PageIntrouvable() {
  usePageMeta('Page introuvable');
  return (
    <div className="conteneur section">
      <EtatVide titre="Cette page n'existe pas" niveau={1}
        action={<Bouton as={Link} to="/">Retour à l'accueil</Bouton>}>
        Le lien est peut-être ancien ou mal recopié.
      </EtatVide>
    </div>
  );
}
