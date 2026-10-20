// Répartition en barres horizontales : le texte (libellé et nombre) porte l'information, la barre n'est qu'un repère visuel.
import styles from '../Statistiques.module.css';

export default function Repartition({ titre, idTitre, lignes }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <section className={`carte ${styles.bloc}`} aria-labelledby={idTitre}>
      <h2 id={idTitre} className={styles.titreBloc}>{titre}</h2>
      <ul className={styles.repartition}>
        {lignes.map((l) => (
          <li key={l.cle}>
            <span className={styles.repartitionLibelle}>{l.libelle}</span>
            <span className={styles.piste} aria-hidden="true">
              <span className={styles.remplissage} style={{ width: `${(l.valeur / max) * 100}%` }} />
            </span>
            <strong>{l.valeur}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
