// Ajoute ou retire un produit de la sélection (BF-09).
import { useState } from 'react';

import Bouton from '@/components/ui/Bouton.jsx';
import Icone from '@/components/ui/Icone.jsx';

import { useSelection } from './SelectionContext.jsx';

export default function BoutonSelection({ slug, variante = 'contour', ...props }) {
  const { contient, basculer } = useSelection();
  const [envoi, setEnvoi] = useState(false);
  const choisi = contient(slug);
  return (
    <Bouton variante={variante} chargement={envoi} aria-pressed={choisi} {...props}
      onClick={async () => { setEnvoi(true); try { await basculer(slug); } finally { setEnvoi(false); } }}>
      <Icone nom={choisi ? 'coche' : 'coeur'} taille={18} />
      {choisi ? 'Dans ma sélection' : 'Sélectionner ce produit'}
    </Bouton>
  );
}
