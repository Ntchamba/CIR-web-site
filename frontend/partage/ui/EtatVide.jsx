// Message affiché quand il n'y a rien à montrer (liste vide, page à venir…), avec une action facultative.
import styles from './ui.module.css';

export default function EtatVide({ titre, children, action, niveau = 2 }) {
  const Titre = `h${niveau}`;
  return (
    <div className={styles.vide}>
      <Titre className={styles.videTitre}>{titre}</Titre>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
