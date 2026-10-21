// BF-01 : catalogue de la maquette. Grand bandeau (fenêtre sur la scène du salon : titre italique blanc centré), puis
// colonne de filtres à gauche et grille de grandes images carrées à droite, pagination numérotée.
import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useEcranTelephone } from '@/app/preferences.js';
import { useTraduction } from '@/i18n/index.js';

import CarteProduit from './composants/CarteProduit.jsx';
import Filtres from './composants/Filtres.jsx';
import Pagination from './composants/Pagination.jsx';
import useCatalogue from './useCatalogue.js';

export default function CataloguePage() {
  const { t } = useTraduction();
  usePageMeta(t('catalogue.titre'), t('catalogue.description'));
  const telephone = useEcranTelephone();
  const { criteres, familles, produits, changerCriteres, effacerCriteres } = useCatalogue();
  const actifs = Boolean(criteres.famille || criteres.usage || criteres.q);
  const familleChoisie = (familles.donnees || []).find((f) => f.slug === criteres.famille);

  return (
    <>
      <section className="m-bandeau">
        <div>
          <h1>{t('catalogue.titre')}</h1>
          {!telephone && <p>{t('catalogue.intro')}</p>}
        </div>
      </section>
      {telephone && <div className="m-fenetre-tel"><p style={{ whiteSpace: 'pre-line' }}>{t('catalogue.introTel')}</p></div>}

      <div className="m-fond-flou">
        <div className="m-conteneur m-catalogue">
          <aside aria-label={t('catalogue.filtres.titre')}>
            <Filtres criteres={criteres} familles={familles.donnees || []}
              changerCriteres={changerCriteres} effacerCriteres={effacerCriteres} />
          </aside>

          <section aria-labelledby="titre-resultats" aria-busy={produits.chargement || undefined}>
            <h2 id="titre-resultats" className="visuellement-cache">{t('catalogue.resultats')}</h2>
            {familleChoisie?.description && <p className="m-descr-famille">{familleChoisie.description}</p>}
            {produits.chargement && !produits.elements.length && <Chargement />}
            <MessageErreur erreur={produits.erreur} reessayer={produits.recharger} />
            {!produits.chargement && !produits.erreur && !produits.elements.length && (
              <EtatVide titre={actifs ? t('catalogue.vide.titreFiltres') : t('catalogue.vide.titre')}
                action={actifs && <Bouton variante="contour" onClick={effacerCriteres}>{t('catalogue.filtres.effacer')}</Bouton>}>
                {actifs ? t('catalogue.vide.texteFiltres') : t('catalogue.vide.texte')}
              </EtatVide>
            )}
            {produits.elements.length > 0 && (
              <ul className="m-grille-3">
                {produits.elements.map((p) => <li key={p.id} className="p3d"><CarteProduit produit={p} /></li>)}
              </ul>
            )}
            <Pagination page={produits.page} pages={produits.pages} />
          </section>
        </div>
      </div>
    </>
  );
}
