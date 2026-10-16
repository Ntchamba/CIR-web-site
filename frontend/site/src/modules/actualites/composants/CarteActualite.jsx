// Carte d'une actualité : image, date de publication, titre (lien vers le détail), résumé.
import { Link } from 'react-router';

import { date } from '@partage/utils/format.js';

import ImageMedia from '@/composants/ImageMedia.jsx';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Actualites.module.css';

export default function CarteActualite({ actualite, niveauTitre = 2 }) {
  useTraduction(); // la date suit la langue de l'interface
  const Titre = `h${niveauTitre}`;
  return (
    <article className={styles.carte}>
      {actualite.image?.url && (
        <div className={styles.image}><ImageMedia image={actualite.image} largeur={640} hauteur={360} /></div>
      )}
      <div className={styles.corps}>
        <time dateTime={actualite.publie_le} className={styles.date}>{date(actualite.publie_le)}</time>
        <Titre className={styles.titreCarte}>
          <Link to={`/actualites/${actualite.slug}`} className={styles.lien}>{actualite.titre}</Link>
        </Titre>
        {actualite.resume && <p className={styles.resume}>{actualite.resume}</p>}
      </div>
    </article>
  );
}
