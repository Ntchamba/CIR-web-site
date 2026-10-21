// « Notre sélection / Produits à la une » (maquettes) : produits mis à la une par l'équipe, en grandes images carrées.
// Rien n'est affiché s'il n'y en a pas.
import EnteteSection, { LienSection } from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';
import CarteProduit from '@/modules/catalogue/composants/CarteProduit.jsx';

export default function ProduitsALaUne({ produits = [] }) {
  const { t } = useTraduction();
  if (!produits.length) return null;
  return (
    <section id="salles" className="m-section blanche" aria-labelledby="titre-a-la-une">
      <div className="m-conteneur">
        <EnteteSection id="titre-a-la-une" surtitre={t('accueil.aLaUne.surtitre')} titre={t('accueil.aLaUne.titre')}
          lien="/catalogue" texteLien={t('accueil.aLaUne.toutLeCatalogue')} />
        <ul className="m-grille-4">
          {produits.map((p) => <li key={p.id} className="p3d"><CarteProduit produit={p} /></li>)}
        </ul>
        <LienSection lien="/catalogue" texte={t('accueil.aLaUne.toutLeCatalogue')} />
      </div>
    </section>
  );
}
