// Barre d'avancement : Nouvelle → En négociation → Contrat signé → Travaux → Terminée.
import styles from './Commandes.module.css';

export default function EtapesCommande({ etapes }) {
  return (
    <ol className={styles.etapes} aria-label="Avancement de la commande">
      {etapes.map((e) => (
        <li key={e.code} aria-current={e.en_cours ? 'step' : undefined}
          className={e.faite ? styles.faite : e.en_cours ? styles.enCours : ''}>
          <span className={styles.trait} aria-hidden="true" />
          <span>{e.libelle}</span>
        </li>
      ))}
    </ol>
  );
}
