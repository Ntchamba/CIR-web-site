// Carte d'un produit du catalogue : vignette, famille, référence, nom, accroche, usages, prix (ou « Prix sur devis »).
import { Link } from 'react-router';

import { prix } from '@partage/utils/format.js';

import ImageMedia from '@/composants/ImageMedia.jsx';
import { useTraduction } from '@/i18n/index.js';

import { estUsage } from '../usages.js';

import styles from '../Catalogue.module.css';

export default function CarteProduit({ produit, niveauTitre = 3 }) {
  const { t } = useTraduction();
  const Titre = `h${niveauTitre}`;
  const usages = (produit.usages || []).filter(estUsage); // jamais de clé brute pour un usage inconnu
  return (
    <article className={styles.carte}>
      <div className={styles.vignette}>
        {produit.image?.url
          ? <ImageMedia image={produit.image} largeur={640} hauteur={480} />
          : <span className={styles.sansImage} aria-hidden="true">{produit.reference || produit.nom?.slice(0, 2)}</span>}
        <div className={styles.pastilles}>
          {produit.est_nouveau && <span className={styles.nouveau}>{t('catalogue.carte.nouveau')}</span>}
          {produit.a_la_une && <span className={styles.une}>{t('catalogue.carte.aLaUne')}</span>}
        </div>
      </div>
      <div className={styles.corps}>
        <p className={styles.famille}>
          {produit.famille?.nom}
          {produit.reference && <span className={styles.reference}>{produit.reference}</span>}
        </p>
        <Titre className={styles.nomProduit}>
          {/* Toute la carte est cliquable : le lien s'étend sur la carte (CSS). */}
          <Link to={`/catalogue/${produit.slug}`} className={styles.lienCarte}>{produit.nom}</Link>
        </Titre>
        {produit.accroche && <p className={styles.accroche}>{produit.accroche}</p>}
        {usages.length > 0 && (
          <ul className={styles.usages} aria-label={t('catalogue.carte.usages')}>
            {usages.map((u) => <li key={u}>{t(`usages.${u}`)}</li>)}
          </ul>
        )}
        <p className={styles.prix}>{prix(produit.prix, produit.unite_prix)}</p>
      </div>
    </article>
  );
}
