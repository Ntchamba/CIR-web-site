// En-tête d'une section : surtitre facultatif, titre (h2), lien facultatif à droite.
import { Link } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import styles from './Composants.module.css';

export default function EnteteSection({ id, surtitre, titre, lien, texteLien }) {
  return (
    <div className={`${styles.enteteSection} p3d`}>
      <div>
        {surtitre && <span className={styles.surtitre}>{surtitre}</span>}
        <h2 id={id}>{titre}</h2>
      </div>
      {lien && (
        <Link to={lien} className={styles.lienSection}>
          {texteLien}
          <Icone nom="fleche" taille={18} />
        </Link>
      )}
    </div>
  );
}
