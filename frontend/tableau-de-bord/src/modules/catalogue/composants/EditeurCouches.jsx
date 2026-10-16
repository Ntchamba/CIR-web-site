// Plan de coupe d'un produit (BF-06) : couches de la surface (première) vers le support (dernière),
// avec leur épaisseur. Un aperçu dessine l'empilement ; il est doublé d'une liste lisible.
import { useTraduction } from '@/i18n/index.js';

import EditeurLignes from './EditeurLignes.jsx';
import styles from '../Catalogue.module.css';

export const CHAMPS_COUCHE = ['nom', 'epaisseur'];

const TEINTES = ['#1177A8', '#3d8fb8', '#6aa8c8', '#97c1d8', '#c3dbe8', '#dfe9ef'];

function PlanCoupe({ lignes }) {
  const { t } = useTraduction();
  const couches = lignes.filter((l) => String(l.nom).trim());
  if (!couches.length) return null;
  return (
    <figure className={styles.planCoupe}>
      <figcaption>{t('catalogue.couches.apercu')}</figcaption>
      <ol>
        {couches.map((c, i) => (
          <li key={c.cle} style={{ background: TEINTES[Math.min(i, TEINTES.length - 1)], color: i < 3 ? '#fff' : 'var(--encre)' }}>
            <span>{c.nom}</span>
            {String(c.epaisseur).trim() && <span>{c.epaisseur}</span>}
          </li>
        ))}
        <li className={styles.support}>{t('catalogue.couches.support')}</li>
      </ol>
    </figure>
  );
}

export default function EditeurCouches({ lignes, surChangement, erreur }) {
  const { t } = useTraduction();
  return (
    <EditeurLignes lignes={lignes} surChangement={surChangement} erreur={erreur}
      champsTraduits={[{ nom: 'nom', libelle: t('catalogue.couches.nom') }]}
      champsFixes={[{ nom: 'epaisseur', libelle: t('catalogue.couches.epaisseur') }]}
      libelles={{
        titre: t('catalogue.couches.titre'),
        aide: t('catalogue.couches.aide'),
        ajouter: t('catalogue.couches.ajouter'),
        vide: t('catalogue.couches.vide'),
        ligne: (n) => t('catalogue.couches.ligne', { n }),
      }}
      apercu={(l) => <PlanCoupe lignes={l} />} />
  );
}
