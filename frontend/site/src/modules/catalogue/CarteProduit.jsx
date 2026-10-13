// Vignette carrée d'un produit, titre léger et prix (catalogue et « Produits à la une »).
import { Link } from 'react-router-dom';

import { prix } from '@shared/format.js';

import styles from './Catalogue.module.css';

export default function CarteProduit({ produit, prioritaire = false }) {
  return (
    <Link to={`/catalogue/${produit.slug}`} className={styles.carte}>
      <span className={styles.image}>
        {produit.vignette
          ? <img src={produit.vignette} alt={produit.nom} width="560" height="560"
              loading={prioritaire ? 'eager' : 'lazy'} decoding="async" />
          : <span className={styles.sansImage} aria-hidden="true" />}
        {produit.est_nouveau && <span className={styles.nouveau}>Nouveau</span>}
      </span>
      <span className={styles.nom}>{produit.nom}</span>
      <span className={styles.prix}>{prix(produit.prix, produit.unite_prix)}</span>
    </Link>
  );
}
