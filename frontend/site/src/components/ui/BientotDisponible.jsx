// Emplacement réservé à une fonction prévue (paiement, appels) : visible, mais pas encore active.
import styles from './ui.module.css';

export default function BientotDisponible({ titre, children }) {
  return (
    <div className={styles.bientot}>
      <span className={styles.bientotPastille}>Bientôt disponible</span>
      <strong>{titre}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
