// Bandeau photo (la maison, tirée de la vidéo) en tête d'une page : il passe sous la barre de navigation
// translucide. Il porte le titre de la page (h1) et son introduction ; `children` : actions à droite.
// Image décorative : taille réservée (aucun décalage de mise en page), chargée tout de suite (haut de page).
import styles from './Composants.module.css';

export default function BandeauPhoto({ titre, intro, children }) {
  return (
    <section className={styles.bandeauPhoto}>
      <picture>
        <source media="(max-width: 700px)" srcSet="/media/accueil/bandeau-maison-800.webp" />
        <img src="/media/accueil/bandeau-maison-1280.webp" alt="" width="1280" height="320" fetchPriority="high" decoding="async" />
      </picture>
      <div className={styles.voileBandeau} aria-hidden="true" />
      <div className={`conteneur ${styles.texteBandeau}`}>
        <div>
          <h1>{titre}</h1>
          {intro && <p>{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
