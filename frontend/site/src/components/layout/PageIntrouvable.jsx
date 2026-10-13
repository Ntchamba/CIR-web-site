// Page 404.
import usePageMeta from '@/hooks/usePageMeta.js';

import Bouton from '../ui/Bouton.jsx';
import EtatVide from '../ui/EtatVide.jsx';

export default function PageIntrouvable() {
  usePageMeta('Page introuvable');
  return (
    <div className="conteneur section">
      <EtatVide titre="Cette page n'existe pas" action={<Bouton vers="/catalogue">Voir le catalogue</Bouton>}>
        Le lien est peut-être ancien. Le catalogue et les réalisations sont toujours là.
      </EtatVide>
    </div>
  );
}
