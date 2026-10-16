// BF-01 : catalogue des revêtements, filtrable par famille, usage et recherche ; « Voir plus ».
import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import CarteProduit from './composants/CarteProduit.jsx';
import Filtres from './composants/Filtres.jsx';
import useCatalogue from './useCatalogue.js';
import styles from './Catalogue.module.css';

export default function CataloguePage() {
  const { t } = useTraduction();
  usePageMeta(t('catalogue.titre'), t('catalogue.description'));
  const { criteres, familles, produits, changerCriteres, effacerCriteres } = useCatalogue();
  const actifs = Boolean(criteres.famille || criteres.usage || criteres.q);
  const familleChoisie = (familles.donnees || []).find((f) => f.slug === criteres.famille);

  return (
    <div className="conteneur section">
      <header className={styles.entete}>
        <h1 className="titre-page">{t('catalogue.titre')}</h1>
        <p className={styles.intro}>{t('catalogue.intro')}</p>
      </header>

      <div className={styles.disposition}>
        <aside aria-label={t('catalogue.filtres.titre')}>
          <Filtres criteres={criteres} familles={familles.donnees || []}
            changerCriteres={changerCriteres} effacerCriteres={effacerCriteres} />
        </aside>

        <section aria-labelledby="titre-resultats" aria-busy={produits.chargement || undefined}>
          <h2 id="titre-resultats" className="visuellement-cache">{t('catalogue.resultats')}</h2>
          {familleChoisie?.description && <p className={styles.descriptionFamille}>{familleChoisie.description}</p>}
          {produits.chargement && !produits.elements.length && <Chargement />}
          <MessageErreur erreur={produits.erreur} reessayer={produits.recharger} />
          {!produits.chargement && !produits.erreur && !produits.elements.length && (
            <EtatVide titre={actifs ? t('catalogue.vide.titreFiltres') : t('catalogue.vide.titre')}
              action={actifs && <Bouton variante="contour" onClick={effacerCriteres}>{t('catalogue.filtres.effacer')}</Bouton>}>
              {actifs ? t('catalogue.vide.texteFiltres') : t('catalogue.vide.texte')}
            </EtatVide>
          )}
          {produits.elements.length > 0 && (
            <ul className={styles.grille}>
              {produits.elements.map((p) => <li key={p.id}><CarteProduit produit={p} /></li>)}
            </ul>
          )}
          <VoirPlus liste={produits} />
        </section>
      </div>
    </div>
  );
}
