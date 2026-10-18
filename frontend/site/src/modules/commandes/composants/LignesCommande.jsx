// Produits (et designs) d'une commande. Le nom du produit arrive traduit ; un produit retiré du catalogue
// n'a plus de lien.
import { Link } from 'react-router';

import ImageMedia from '@/composants/ImageMedia.jsx';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

export default function LignesCommande({ lignes = [] }) {
  const { t } = useTraduction();
  if (!lignes.length) return null;
  return (
    <section aria-labelledby="titre-lignes" className={styles.bloc}>
      <h2 id="titre-lignes">{t('commandes.detail.produits')}</h2>
      <ul className={styles.liste}>
        {lignes.map((l) => (
          <li key={l.id} className={styles.ligne}>
            <span className={styles.miniature}>
              {l.produit?.image?.url
                ? <ImageMedia image={l.produit.image} largeur={120} hauteur={90} alt="" />
                : <span aria-hidden="true">{l.produit?.reference || ''}</span>}
            </span>
            <span className={styles.ligneTexte}>
              {l.produit
                ? <Link to={`/catalogue/${l.produit.slug}`}>{l.produit.nom}</Link>
                : <span>{t('commandes.detail.produitRetire')}</span>}
              {l.produit?.reference && <span className={styles.meta}>{l.produit.reference}</span>}
              {l.design && (
                <span className={styles.meta}>
                  {l.design.couleur && <span className={styles.pastilleCouleur} style={{ background: l.design.couleur }} aria-hidden="true" />}
                  {t('commandes.detail.design', { nom: l.design.nom })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
