// BF-06 : plan de coupe, les couches du revêtement de la surface jusqu'au support en béton.
import styles from './Produit.module.css';

export default function PlanCoupe({ couches }) {
  return (
    <figure className={styles.coupe} aria-labelledby="titre-coupe">
      <figcaption id="titre-coupe">Plan de coupe</figcaption>
      <ol>
        {couches.map((c, i) => (
          <li key={c.id ?? i} style={{ '--niveau': i }}>
            <span>{c.nom}</span>
            {c.epaisseur && <span className={styles.epaisseur}>{c.epaisseur}</span>}
          </li>
        ))}
        <li className={styles.support}><span>Support en béton</span></li>
      </ol>
    </figure>
  );
}
