// Indicateur de chargement annoncé aux lecteurs d'écran. `plein` : occupe la hauteur d'une page.
import styles from './ui.module.css';

export default function Chargement({ plein = false, texte = 'Chargement…' }) {
  return (
    <div className={`${styles.chargement} ${plein ? styles.chargementPlein : ''}`} role="status" aria-live="polite">
      <span className={styles.roue} aria-hidden="true" />
      <span>{texte}</span>
    </div>
  );
}
