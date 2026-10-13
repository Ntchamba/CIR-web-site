// Comparaison avant / après d'un chantier.
import styles from './Realisations.module.css';

export default function AvantApres({ realisation }) {
  return (
    <section className="section" aria-label="Avant, après">
      <div className={`conteneur ${styles.avantApres}`}>
        <figure>
          <img src={realisation.image_avant} alt={`${realisation.titre}, avant les travaux`} width="1280" height="720"
            loading="lazy" decoding="async" />
          <figcaption>Avant : béton brut</figcaption>
        </figure>
        <figure>
          <img src={realisation.image} alt={`${realisation.titre}, après la pose de la résine époxy`} width="1280"
            height="720" loading="lazy" decoding="async" />
          <figcaption>Après : résine époxy</figcaption>
        </figure>
      </div>
    </section>
  );
}
