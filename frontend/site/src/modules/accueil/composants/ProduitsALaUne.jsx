// Produits mis à la une par l'équipe. Rien n'est affiché s'il n'y en a pas.
import EnteteSection from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';
import CarteProduit from '@/modules/catalogue/composants/CarteProduit.jsx';

import styles from '../Accueil.module.css';

export default function ProduitsALaUne({ produits = [] }) {
  const { t } = useTraduction();
  if (!produits.length) return null;
  return (
    <section className="salle" aria-labelledby="titre-a-la-une">
      <div className="conteneur">
        <EnteteSection id="titre-a-la-une" surtitre={t('accueil.aLaUne.surtitre')} titre={t('accueil.aLaUne.titre')}
          lien="/catalogue" texteLien={t('accueil.aLaUne.toutLeCatalogue')} />
        <ul className={styles.grille}>
          {produits.map((p) => <li key={p.id} className="p3d"><CarteProduit produit={p} /></li>)}
        </ul>
      </div>
    </section>
  );
}
