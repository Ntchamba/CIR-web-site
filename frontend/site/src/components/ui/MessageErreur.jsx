// Message d'erreur lisible, avec un bouton « Réessayer » si une action est fournie.
import styles from './ui.module.css';

export default function MessageErreur({ erreur, reessayer }) {
  if (!erreur) return null;
  const texte = typeof erreur === 'string' ? erreur : erreur.message;
  return (
    <div className={styles.erreur} role="alert">
      <span>{texte}</span>
      {reessayer && <button type="button" onClick={reessayer}>Réessayer</button>}
    </div>
  );
}
