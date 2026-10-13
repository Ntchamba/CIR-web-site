// Bouton principal du site : un lien (vers) ou un bouton (onClick). Variantes : plein, contour, clair, texte.
import { Link } from 'react-router-dom';

import styles from './Bouton.module.css';

export default function Bouton({ vers, variante = 'plein', taille, chargement, className = '', children, ...props }) {
  const classes = [styles.bouton, styles[variante], taille && styles[taille], className].filter(Boolean).join(' ');
  if (vers) {
    const externe = /^(https?:|tel:|mailto:)/.test(vers);
    return externe
      ? <a href={vers} className={classes} {...props}>{children}</a>
      : <Link to={vers} className={classes} {...props}>{children}</Link>;
  }
  return (
    <button type="button" className={classes} disabled={chargement || props.disabled} aria-busy={chargement || undefined}
      {...props}>
      {chargement ? <span className={styles.roue} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
