// Bouton de la charte CIR. Variantes : plein (défaut), contour, sombre, texte. Tailles : petit, large.
// Par défaut un <button type="button"> ; `as` permet d'en faire un lien sans dépendre du routeur :
//   <Bouton as={Link} to="/catalogue">Catalogue</Bouton>   <Bouton as="a" href="tel:+237…">Appeler</Bouton>
import styles from './ui.module.css';

export default function Bouton({
  as: Composant = 'button',
  variante = 'plein',
  taille,
  chargement = false,
  className = '',
  children,
  ...props
}) {
  const classes = [styles.bouton, styles[variante], taille && styles[taille], className].filter(Boolean).join(' ');
  if (Composant !== 'button') {
    return <Composant className={classes} {...props}>{children}</Composant>;
  }
  return (
    <button
      type="button"
      {...props}
      className={classes}
      disabled={chargement || props.disabled}
      aria-busy={chargement || undefined}
    >
      {chargement && <span className={styles.roueBouton} aria-hidden="true" />}
      {children}
    </button>
  );
}
