// Grande image de la maison en haut des pages Catalogue, Réalisations et Mes commandes.
// L'en-tête transparent se superpose à elle.
import styles from './Bandeau.module.css';

export default function Bandeau({ titre, sousTitre, children }) {
  return (
    <section className={styles.bandeau}>
      <img
        className={styles.image}
        src="/media/accueil/bandeau-maison-1280.webp"
        srcSet="/media/accueil/bandeau-maison-800.webp 800w, /media/accueil/bandeau-maison-1280.webp 1280w"
        sizes="100vw"
        alt=""
        width="1280"
        height="720"
        fetchPriority="high"
      />
      <div className={styles.voile} aria-hidden="true" />
      <div className={styles.texte}>
        <h1>{titre}</h1>
        {sousTitre && <p>{sousTitre}</p>}
        {children}
      </div>
    </section>
  );
}
