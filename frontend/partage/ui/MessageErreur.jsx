// Message d'erreur lisible (texte ou ErreurApi), avec un bouton « Réessayer » si `reessayer` est fourni.
import styles from './ui.module.css';

export default function MessageErreur({ erreur, reessayer }) {
  if (!erreur) return null;
  const texte = typeof erreur === 'string' ? erreur : erreur.message || 'Une erreur est survenue. Réessayez.';
  return (
    <div className={styles.erreur} role="alert">
      <span>{texte}</span>
      {reessayer && <button type="button" onClick={reessayer}>Réessayer</button>}
    </div>
  );
}
