// Tableau des indicateurs techniques d'un produit (libellé, valeur), traduits, dans l'ordre de la liste.
import { useTraduction } from '@/i18n/index.js';

import EditeurLignes from './EditeurLignes.jsx';

export const CHAMPS_CARACTERISTIQUE = ['libelle', 'valeur'];

export default function EditeurCaracteristiques({ lignes, surChangement, erreur }) {
  const { t } = useTraduction();
  return (
    <EditeurLignes lignes={lignes} surChangement={surChangement} erreur={erreur}
      champsTraduits={[
        { nom: 'libelle', libelle: t('catalogue.caracteristiques.libelle') },
        { nom: 'valeur', libelle: t('catalogue.caracteristiques.valeur') },
      ]}
      libelles={{
        titre: t('catalogue.caracteristiques.titre'),
        aide: t('catalogue.caracteristiques.aide'),
        ajouter: t('catalogue.caracteristiques.ajouter'),
        vide: t('catalogue.caracteristiques.vide'),
        ligne: (n) => t('catalogue.caracteristiques.ligne', { n }),
      }} />
  );
}
