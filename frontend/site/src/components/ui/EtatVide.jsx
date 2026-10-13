// Message affiché quand une liste est vide (aucune commande, sélection vide…).
import styles from './ui.module.css';

export default function EtatVide({ titre, children, action }) {
  return (
    <div className={styles.vide}>
      <strong>{titre}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
